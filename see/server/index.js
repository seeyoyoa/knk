/**
 * RocketStore 后端服务器
 * 
 * 功能：
 * - 支付宝当面付 API 集成（真实下单、回调验签）
 * - USDT 支付（生成收款地址、链上回调确认）
 * - 支付成功后自动开通套餐和发放订阅链接
 * - 用户订阅 API
 * 
 * 启动方式：node server/index.js
 * 依赖：npm install express crypto axios qs
 */

const express = require('express');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const qs = require('qs');

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// CORS 支持
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

// ============ 配置 ============
const CONFIG = {
  port: 3000,
  // 支付宝当面付配置
  alipay: {
    appId: process.env.ALIPAY_APP_ID || '',
    privateKey: process.env.ALIPAY_PRIVATE_KEY || '',
    alipayPublicKey: process.env.ALIPAY_PUBLIC_KEY || '',
    gatewayUrl: 'https://openapi.alipay.com/gateway.do',
    notifyUrl: process.env.ALIPAY_NOTIFY_URL || 'http://yourdomain.com/api/payment/alipay/notify',
  },
  // USDT 配置
  usdt: {
    network: process.env.USDT_NETWORK || 'TRC20',
    walletAddress: process.env.USDT_WALLET_ADDRESS || '',
    // 使用 TronGrid API 监控 TRC20 交易
    tronGridApiKey: process.env.TRONGRID_API_KEY || '',
    // 或使用 NOWPayments API
    nowPaymentsApiKey: process.env.NOWPAYMENTS_API_KEY || '',
  },
  // 数据库（使用 JSON 文件模拟）
  dbPath: path.join(__dirname, 'db.json'),
  // 订阅基础 URL
  baseUrl: process.env.BASE_URL || 'http://localhost:3000',
};

// ============ 简易数据库 ============
function loadDB() {
  try {
    const data = fs.readFileSync(CONFIG.dbPath, 'utf8');
    return JSON.parse(data);
  } catch {
    return {
      orders: [],
      users: [],
      plans: [],
      subscriptions: [],
    };
  }
}

function saveDB(db) {
  fs.writeFileSync(CONFIG.dbPath, JSON.stringify(db, null, 2));
}

// ============ 支付宝工具函数 ============

/**
 * RSA2 签名
 */
function rsaSign(params, privateKey) {
  const sortedKeys = Object.keys(params).sort();
  const signStr = sortedKeys.map(k => `${k}=${params[k]}`).join('&');
  
  const sign = crypto.createSign('RSA-SHA256');
  sign.update(signStr);
  return sign.sign(privateKey, 'base64');
}

/**
 * 验证支付宝回调签名
 */
function verifyAlipayNotify(params, publicKey) {
  const { sign, sign_type, ...restParams } = params;
  const sortedKeys = Object.keys(restParams).sort();
  const verifyStr = sortedKeys.map(k => `${k}=${restParams[k]}`).join('&');
  
  const verify = crypto.createVerify('RSA-SHA256');
  verify.update(verifyStr);
  return verify.verify(publicKey, sign, 'base64');
}

/**
 * 构建支付宝请求参数
 */
function buildAlipayParams(method, bizContent) {
  const params = {
    app_id: CONFIG.alipay.appId,
    method,
    charset: 'utf-8',
    sign_type: 'RSA2',
    timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
    version: '1.0',
    biz_content: JSON.stringify(bizContent),
    notify_url: CONFIG.alipay.notifyUrl,
  };
  
  params.sign = rsaSign(params, CONFIG.alipay.privateKey);
  return params;
}

/**
 * 调用支付宝 API
 */
async function callAlipayAPI(method, bizContent) {
  const params = buildAlipayParams(method, bizContent);
  const queryString = qs.stringify(params);
  const url = `${CONFIG.alipay.gatewayUrl}?${queryString}`;
  
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: queryString,
  });
  
  return await response.json();
}

// ============ USDT 工具函数 ============

/**
 * 生成唯一收款地址（每个订单独立 memo/tag）
 */
function generateUSDTAddress(orderId) {
  // 实际应用中应该使用支付网关API生成唯一地址
  // 这里使用钱包地址 + 订单ID作为标识
  return {
    address: CONFIG.usdt.walletAddress,
    memo: orderId, // TRC20 不需要 memo，但可以用于标识
    network: CONFIG.usdt.network,
  };
}

/**
 * 通过 TronGrid API 查询 TRC20 交易
 */
async function checkTRC20Transaction(txHash) {
  try {
    const response = await fetch(`https://api.trongrid.io/v1/transactions/${txHash}`, {
      headers: {
        'TRON-PRO-API-KEY': CONFIG.usdt.tronGridApiKey,
      },
    });
    
    const data = await response.json();
    
    if (data.success && data.data && data.data.length > 0) {
      const tx = data.data[0];
      // 解析 USDT 转账信息
      return {
        confirmed: tx.ret && tx.ret[0] && tx.ret[0].contractRet === 'SUCCESS',
        amount: tx.amount || 0,
        from: tx.raw_data && tx.raw_data.contract && tx.raw_data.contract[0].parameter.value.from_address,
        to: tx.raw_data && tx.raw_data.contract && tx.raw_data.contract[0].parameter.value.to_address,
        timestamp: tx.raw_data ? tx.raw_data.timestamp : 0,
      };
    }
    
    return { confirmed: false };
  } catch (error) {
    console.error('查询 TRC20 交易失败:', error);
    return { confirmed: false, error: error.message };
  }
}

/**
 * 通过 NOWPayments API 创建 USDT 订单
 */
async function createNOWPaymentsOrder(amount, currency = 'usd') {
  try {
    const response = await fetch('https://api.nowpayments.io/v1/payment', {
      method: 'POST',
      headers: {
        'x-api-key': CONFIG.usdt.nowPaymentsApiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        price_amount: amount,
        price_currency: currency,
        pay_currency: 'usdttrc20',
        ipn_callback_url: `${CONFIG.baseUrl}/api/payment/usdt/webhook`,
        order_id: `ORDER_${Date.now()}`,
      }),
    });
    
    return await response.json();
  } catch (error) {
    console.error('创建 NOWPayments 订单失败:', error);
    return null;
  }
}

// ============ 支付成功处理 ============

/**
 * 支付成功后自动开通套餐
 */
async function handlePaymentSuccess(orderId, paymentMethod) {
  const db = loadDB();
  const order = db.orders.find(o => o.id === orderId);
  
  if (!order || order.status === 'completed') {
    return { success: false, message: '订单不存在或已处理' };
  }
  
  // 更新订单状态
  order.status = 'completed';
  order.paidAt = new Date().toISOString();
  order.paymentMethod = paymentMethod;
  
  // 查找用户
  const user = db.users.find(u => u.id === order.userId);
  if (!user) {
    saveDB(db);
    return { success: false, message: '用户不存在' };
  }
  
  // 查找套餐
  const plan = db.plans.find(p => p.id === order.planId);
  if (!plan) {
    saveDB(db);
    return { success: false, message: '套餐不存在' };
  }
  
  // 计算到期时间
  const now = new Date();
  const expireDate = new Date(now.getTime() + plan.duration * 24 * 60 * 60 * 1000);
  
  // 更新用户信息
  user.plan = plan;
  user.planExpire = expireDate.toISOString().split('T')[0];
  user.status = 'active';
  
  // 生成订阅链接
  const subToken = crypto.randomBytes(16).toString('hex');
  user.subscriptionToken = subToken;
  user.subscriptionUrl = `${CONFIG.baseUrl}/api/sub/${subToken}`;
  
  // 保存数据库
  saveDB(db);
  
  return {
    success: true,
    message: '套餐已开通',
    data: {
      userId: user.id,
      planName: plan.name,
      expireDate: user.planExpire,
      subscriptionUrl: user.subscriptionUrl,
    },
  };
}

// ============ API 路由 ============

// 获取支付配置
app.get('/api/payment/config', (req, res) => {
  res.json({
    success: true,
    data: {
      alipay: {
        enabled: !!CONFIG.alipay.appId,
      },
      usdt: {
        enabled: !!CONFIG.usdt.walletAddress,
        network: CONFIG.usdt.network,
      },
    },
  });
});

// 获取 USDT 汇率
app.get('/api/payment/usdt/rate', async (req, res) => {
  try {
    // 从 CoinGecko 获取实时汇率
    const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=tether&vs_currencies=cny');
    const data = await response.json();
    const rate = data.tether?.cny || 7.2;
    
    res.json({
      success: true,
      rate,
    });
  } catch {
    res.json({
      success: true,
      rate: 7.2,
    });
  }
});

// 创建用户订单
app.post('/api/user/order', (req, res) => {
  const { userId, planId } = req.body;
  
  if (!userId || !planId) {
    return res.json({ success: false, message: '缺少必要参数' });
  }
  
  const db = loadDB();
  const user = db.users.find(u => u.id === userId);
  const plan = db.plans.find(p => p.id === planId);
  
  if (!user || !plan) {
    return res.json({ success: false, message: '用户或套餐不存在' });
  }
  
  const orderId = `ORD_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  
  const order = {
    id: orderId,
    userId,
    planId,
    amount: plan.price,
    status: 'pending',
    paymentMethod: '',
    createdAt: new Date().toISOString(),
    paidAt: null,
  };
  
  db.orders.push(order);
  saveDB(db);
  
  res.json({
    success: true,
    data: { orderId, amount: plan.price, planName: plan.name },
  });
});

// ============ 支付宝当面付 API ============

/**
 * 创建支付宝当面付订单
 * POST /api/payment/alipay/create
 * Body: { orderId, userId, amount, subject }
 */
app.post('/api/payment/alipay/create', async (req, res) => {
  const { orderId, userId, amount, subject } = req.body;
  
  if (!CONFIG.alipay.appId || !CONFIG.alipay.privateKey) {
    // 演示模式：返回模拟数据
    return res.json({
      success: true,
      qrCode: `alipay://alipayclient/?${JSON.stringify({
        requestType: 'SafePay',
        fromAppUrlQuery: 'safepay',
        dataString: `h5_route_token="mock_token_${orderId}"`,
      })}`,
      outTradeNo: orderId,
      qrCodeUrl: `https://qr.alipay.com/mock_${orderId}`,
      mode: 'demo',
    });
  }
  
  try {
    const result = await callAlipayAPI('alipay.trade.precreate', {
      out_trade_no: orderId,
      total_amount: amount.toFixed(2),
      subject: subject || 'RocketStore 套餐订阅',
      timeout_express: '15m',
    });
    
    const responseKey = 'alipay_trade_precreate_response';
    const response = result[responseKey];
    
    if (response && response.code === '10000') {
      // 更新订单状态
      const db = loadDB();
      const order = db.orders.find(o => o.id === orderId);
      if (order) {
        order.status = 'processing';
        saveDB(db);
      }
      
      res.json({
        success: true,
        qrCode: response.qr_code,
        outTradeNo: orderId,
        mode: 'live',
      });
    } else {
      res.json({
        success: false,
        message: response?.sub_msg || '创建支付宝订单失败',
        error: response?.sub_code,
      });
    }
  } catch (error) {
    res.json({
      success: false,
      message: error.message,
    });
  }
});

/**
 * 支付宝异步回调通知
 * POST /api/payment/alipay/notify
 * 
 * 支付宝会 POST 以下参数：
 * - out_trade_no: 商户订单号
 * - trade_no: 支付宝交易号
 * - trade_status: 交易状态 (TRADE_SUCCESS / TRADE_CLOSED)
 * - total_amount: 交易金额
 * - sign: 签名
 * - ... 其他参数
 */
app.post('/api/payment/alipay/notify', (req, res) => {
  const params = req.body;
  
  // 验证签名
  const isValid = verifyAlipayNotify(params, CONFIG.alipay.alipayPublicKey);
  
  if (!isValid) {
    console.error('支付宝回调签名验证失败');
    return res.send('fail');
  }
  
  const { out_trade_no: orderId, trade_no: tradeNo, trade_status: tradeStatus, total_amount } = params;
  
  if (tradeStatus === 'TRADE_SUCCESS' || tradeStatus === 'TRADE_FINISHED') {
    // 支付成功，自动开通套餐
    handlePaymentSuccess(orderId, 'alipay').then(result => {
      if (result.success) {
        console.log(`[支付宝] 订单 ${orderId} 支付成功，套餐已开通`);
      } else {
        console.error(`[支付宝] 订单 ${orderId} 开通套餐失败: ${result.message}`);
      }
    });
  }
  
  // 返回 success 告诉支付宝已收到通知
  res.send('success');
});

// ============ USDT 支付 API ============

/**
 * 创建 USDT 支付订单
 * POST /api/payment/usdt/create
 * Body: { orderId, userId, amountUSD }
 */
app.post('/api/payment/usdt/create', async (req, res) => {
  const { orderId, userId, amountUSD } = req.body;
  
  if (!CONFIG.usdt.walletAddress) {
    return res.json({
      success: false,
      message: 'USDT 支付未配置',
    });
  }
  
  try {
    // 方式1：使用 NOWPayments（推荐，自动处理）
    if (CONFIG.usdt.nowPaymentsApiKey) {
      const payment = await createNOWPaymentsOrder(amountUSD);
      
      if (payment && payment.pay_address) {
        const db = loadDB();
        const order = db.orders.find(o => o.id === orderId);
        if (order) {
          order.status = 'processing';
          saveDB(db);
        }
        
        return res.json({
          success: true,
          address: payment.pay_address,
          amount: payment.pay_amount,
          network: CONFIG.usdt.network,
          paymentId: payment.payment_id,
          mode: 'nowpayments',
        });
      }
    }
    
    // 方式2：直接生成收款地址（需要手动确认）
    const addressInfo = generateUSDTAddress(orderId);
    
    const db = loadDB();
    const order = db.orders.find(o => o.id === orderId);
    if (order) {
      order.status = 'processing';
      saveDB(db);
    }
    
    res.json({
      success: true,
      address: addressInfo.address,
      amount: amountUSD.toFixed(2),
      network: CONFIG.usdt.network,
      memo: addressInfo.memo,
      mode: 'direct',
    });
  } catch (error) {
    res.json({
      success: false,
      message: error.message,
    });
  }
});

/**
 * USDT 手动确认（用户提交交易哈希）
 * POST /api/payment/usdt/callback
 * Body: { txHash, network, amount, to }
 */
app.post('/api/payment/usdt/callback', async (req, res) => {
  const { txHash, network, amount, to } = req.body;
  
  if (!txHash) {
    return res.json({ success: false, message: '请提供交易哈希' });
  }
  
  try {
    // 查询链上交易
    let txResult;
    if (network === 'TRC20' || !network) {
      txResult = await checkTRC20Transaction(txHash);
    } else {
      // ERC20/BEP20 可以使用 Etherscan API
      txResult = { confirmed: false, message: '暂不支持此网络的自动验证' };
    }
    
    if (txResult.confirmed) {
      // 找到对应的订单
      const db = loadDB();
      const order = db.orders.find(o => 
        o.status === 'processing' && 
        o.amount === parseFloat(amount)
      );
      
      if (order) {
        await handlePaymentSuccess(order.id, 'usdt');
        return res.json({
          success: true,
          message: '支付确认成功，套餐已开通',
        });
      }
    }
    
    res.json({
      success: txResult.confirmed,
      message: txResult.confirmed ? '支付已确认' : '交易未确认或不存在',
      txData: txResult,
    });
  } catch (error) {
    res.json({
      success: false,
      message: error.message,
    });
  }
});

/**
 * USDT Webhook 回调（NOWPayments 等支付平台回调）
 * POST /api/payment/usdt/webhook
 */
app.post('/api/payment/usdt/webhook', (req, res) => {
  const data = req.body;
  
  console.log('[USDT Webhook] 收到回调:', JSON.stringify(data));
  
  // 验证回调签名（NOWPayments 使用 IPN secret）
  // 实际应用中需要验证签名
  
  if (data.payment_status === 'finished') {
    const orderId = data.order_id;
    
    handlePaymentSuccess(orderId, 'usdt').then(result => {
      if (result.success) {
        console.log(`[USDT] 订单 ${orderId} 支付成功，套餐已开通`);
      } else {
        console.error(`[USDT] 订单 ${orderId} 开通套餐失败: ${result.message}`);
      }
    });
  }
  
  res.json({ success: true });
});

// ============ 邮件 API ============
const emailRoutes = require('./routes/email');
app.use('/api/email', emailRoutes);

// ============ 订阅 API ============

/**
 * 获取用户订阅内容
 * GET /api/sub/:token
 */
app.get('/api/sub/:token', (req, res) => {
  const { token } = req.params;
  
  const db = loadDB();
  const user = db.users.find(u => u.subscriptionToken === token);
  
  if (!user) {
    return res.status(404).json({ error: '订阅链接无效' });
  }
  
  if (user.status !== 'active') {
    return res.status(403).json({ error: '账户已暂停' });
  }
  
  // 检查是否过期
  if (user.planExpire && new Date(user.planExpire) < new Date()) {
    return res.status(403).json({ error: '套餐已过期' });
  }
  
  // 获取用户可用的节点
  const plan = user.plan;
  if (!plan) {
    return res.status(404).json({ error: '未找到套餐' });
  }
  
  // 这里返回 Base64 编码的节点 URI 列表
  // 实际应用中应该从数据库获取节点信息
  const nodes = db.nodes || [];
  const userNodes = nodes.filter(n => plan.nodeGroups.includes(n.group));
  
  // 生成订阅内容（Base64 编码）
  const subscriptionContent = userNodes.map(n => {
    // 根据节点类型生成对应的 URI
    return `${n.type}://${n.server}:${n.port}#${encodeURIComponent(n.name)}`;
  }).join('\n');
  
  const base64Content = Buffer.from(subscriptionContent).toString('base64');
  
  // 设置订阅响应头
  res.set({
    'Content-Type': 'text/plain; charset=utf-8',
    'Subscription-Userinfo': `upload=0; download=0; total=${plan.dataLimit * 1024 * 1024 * 1024}; expire=${new Date(user.planExpire).getTime() / 1000}`,
  });
  
  res.send(base64Content);
});

// ============ 支付状态查询 ============

/**
 * 查询支付状态
 * GET /api/payment/check/:orderId
 */
app.get('/api/payment/check/:orderId', (req, res) => {
  const { orderId } = req.params;
  
  const db = loadDB();
  const order = db.orders.find(o => o.id === orderId);
  
  if (!order) {
    return res.json({ success: false, message: '订单不存在' });
  }
  
  res.json({
    success: true,
    data: {
      orderId: order.id,
      status: order.status,
      amount: order.amount,
      createdAt: order.createdAt,
      paidAt: order.paidAt,
    },
  });
});

// ============ 初始化数据库 ============
function initDB() {
  if (!fs.existsSync(CONFIG.dbPath)) {
    saveDB({
      orders: [],
      users: [],
      plans: [],
      nodes: [],
      subscriptions: [],
    });
    console.log('数据库已初始化');
  }
}

// ============ 启动服务器 ============
initDB();

app.listen(CONFIG.port, () => {
  console.log(`🚀 RocketStore API Server running on port ${CONFIG.port}`);
  console.log(`📡 订阅服务: ${CONFIG.baseUrl}/api/sub/:token`);
  console.log(`💰 支付宝回调: ${CONFIG.alipay.notifyUrl}`);
  console.log(`🪙 USDT Webhook: ${CONFIG.baseUrl}/api/payment/usdt/webhook`);
});

module.exports = app;
