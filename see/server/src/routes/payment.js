/**
 * 支付路由 - 支付宝当面付、USDT支付
 */
const express = require('express');
const crypto = require('crypto');
const qs = require('qs');
const db = require('../config/database');

const router = express.Router();

// ============ 获取支付配置 ============
router.get('/config', async (req, res) => {
  try {
    const configs = await db.query("SELECT config_key, config_value FROM system_configs WHERE config_key IN ('alipay_enabled', 'usdt_enabled', 'usdt_network', 'usdt_wallet_address', 'usdt_min_amount')");
    const configMap = {};
    for (const c of configs) configMap[c.config_key] = c.config_value;

    res.json({
      success: true,
      data: {
        alipay: { enabled: configMap.alipay_enabled === '1' },
        usdt: {
          enabled: configMap.usdt_enabled === '1',
          network: configMap.usdt_network || 'TRC20',
          walletAddress: configMap.usdt_wallet_address || '',
          minAmount: parseFloat(configMap.usdt_min_amount || '10'),
        },
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: '获取支付配置失败' });
  }
});

// ============ 获取USDT汇率 ============
router.get('/usdt/rate', async (req, res) => {
  try {
    const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=tether&vs_currencies=cny');
    const data = await response.json();
    const rate = data.tether?.cny || 7.2;
    res.json({ success: true, rate });
  } catch {
    res.json({ success: true, rate: 7.2 });
  }
});

// ============ 支付宝当面付 - 创建订单 ============
router.post('/alipay/create', async (req, res) => {
  try {
    const { orderNo, amount, subject } = req.body;
    if (!orderNo || !amount) {
      return res.status(400).json({ success: false, message: '缺少必要参数' });
    }

    // 获取支付宝配置
    const configs = await db.query("SELECT config_key, config_value FROM system_configs WHERE config_key LIKE 'alipay_%'");
    const configMap = {};
    for (const c of configs) configMap[c.config_key] = c.config_value;

    const appId = configMap.alipay_app_id;
    const privateKey = configMap.alipay_private_key;
    const notifyUrl = configMap.alipay_notify_url;

    // 如果未配置，返回演示模式
    if (!appId || !privateKey) {
      return res.json({
        success: true,
        qrCode: `alipay://alipayclient/?${JSON.stringify({ requestType: 'SafePay', fromAppUrlQuery: 'safepay', dataString: `h5_route_token="mock_${orderNo}"` })}`,
        qrCodeUrl: `https://qr.alipay.com/mock_${orderNo}`,
        outTradeNo: orderNo,
        mode: 'demo',
      });
    }

    // RSA2 签名
    const params = {
      app_id: appId,
      method: 'alipay.trade.precreate',
      charset: 'utf-8',
      sign_type: 'RSA2',
      timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
      version: '1.0',
      notify_url: notifyUrl || `${process.env.BASE_URL || 'http://localhost:3000'}/api/payment/alipay/notify`,
      biz_content: JSON.stringify({
        out_trade_no: orderNo,
        total_amount: parseFloat(amount).toFixed(2),
        subject: subject || 'RocketStore 套餐订阅',
        timeout_express: '15m',
      }),
    };

    const sortedKeys = Object.keys(params).sort();
    const signStr = sortedKeys.map(k => `${k}=${params[k]}`).join('&');
    const sign = crypto.createSign('RSA-SHA256');
    sign.update(signStr);
    params.sign = sign.sign(privateKey, 'base64');

    // 调用支付宝 API
    const queryString = qs.stringify(params);
    const response = await fetch(`https://openapi.alipay.com/gateway.do?${queryString}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });
    const result = await response.json();

    const responseKey = 'alipay_trade_precreate_response';
    const apiResponse = result[responseKey];

    if (apiResponse && apiResponse.code === '10000') {
      // 更新订单状态
      await db.execute("UPDATE orders SET status = 'processing', payment_method = 'alipay' WHERE order_no = ?", [orderNo]);

      res.json({
        success: true,
        qrCode: apiResponse.qr_code,
        outTradeNo: orderNo,
        mode: 'live',
      });
    } else {
      res.json({
        success: false,
        message: apiResponse?.sub_msg || '创建支付宝订单失败',
      });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============ 支付宝异步回调 ============
router.post('/alipay/notify', async (req, res) => {
  try {
    const params = req.body;
    const { sign, sign_type, ...restParams } = params;

    // 获取公钥验证签名
    const configs = await db.query("SELECT config_value FROM system_configs WHERE config_key = 'alipay_public_key'");
    const publicKey = configs.length > 0 ? configs[0].config_value : '';

    if (publicKey) {
      const sortedKeys = Object.keys(restParams).sort();
      const verifyStr = sortedKeys.map(k => `${k}=${restParams[k]}`).join('&');
      const verify = crypto.createVerify('RSA-SHA256');
      verify.update(verifyStr);
      const isValid = verify.verify(publicKey, sign, 'base64');
      if (!isValid) {
        console.error('[支付宝] 回调签名验证失败');
        return res.send('fail');
      }
    }

    const { out_trade_no: orderNo, trade_status: tradeStatus } = params;

    if (tradeStatus === 'TRADE_SUCCESS' || tradeStatus === 'TRADE_FINISHED') {
      await handlePaymentSuccess(orderNo, 'alipay', params.trade_no);
    }

    res.send('success');
  } catch (error) {
    console.error('[支付宝] 回调处理失败:', error);
    res.send('fail');
  }
});

// ============ USDT 支付 - 创建订单 ============
router.post('/usdt/create', async (req, res) => {
  try {
    const { orderNo, amountUSD } = req.body;
    if (!orderNo || !amountUSD) {
      return res.status(400).json({ success: false, message: '缺少必要参数' });
    }

    // 获取USDT配置
    const configs = await db.query("SELECT config_key, config_value FROM system_configs WHERE config_key LIKE 'usdt_%'");
    const configMap = {};
    for (const c of configs) configMap[c.config_key] = c.config_value;

    const walletAddress = configMap.usdt_wallet_address;
    if (!walletAddress) {
      return res.json({ success: false, message: 'USDT支付未配置' });
    }

    // 更新订单状态
    await db.execute("UPDATE orders SET status = 'processing', payment_method = 'usdt' WHERE order_no = ?", [orderNo]);

    res.json({
      success: true,
      address: walletAddress,
      amount: parseFloat(amountUSD).toFixed(2),
      network: configMap.usdt_network || 'TRC20',
      memo: orderNo,
      mode: 'direct',
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============ USDT 手动确认 ============
router.post('/usdt/callback', async (req, res) => {
  try {
    const { txHash, network, amount, orderNo } = req.body;
    if (!txHash) {
      return res.json({ success: false, message: '请提供交易哈希' });
    }

    // 查询链上交易 (TRC20)
    if (network === 'TRC20' || !network) {
      try {
        const configs = await db.query("SELECT config_value FROM system_configs WHERE config_key = 'trongrid_api_key'");
        const apiKey = configs.length > 0 ? configs[0].config_value : '';

        if (apiKey) {
          const response = await fetch(`https://api.trongrid.io/v1/transactions/${txHash}`, {
            headers: { 'TRON-PRO-API-KEY': apiKey },
          });
          const data = await response.json();

          if (data.success && data.data?.length > 0) {
            const tx = data.data[0];
            const confirmed = tx.ret?.[0]?.contractRet === 'SUCCESS';
            if (confirmed) {
              await handlePaymentSuccess(orderNo, 'usdt', txHash);
              return res.json({ success: true, message: '支付确认成功，套餐已开通' });
            }
          }
        }
      } catch (err) {
        console.error('[USDT] 链上查询失败:', err);
      }
    }

    res.json({ success: false, message: '交易未确认或无法自动验证' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============ USDT Webhook (NOWPayments) ============
router.post('/usdt/webhook', async (req, res) => {
  try {
    const data = req.body;
    console.log('[USDT Webhook] 收到回调:', JSON.stringify(data));

    if (data.payment_status === 'finished') {
      const orderId = data.order_id;
      await handlePaymentSuccess(orderId, 'usdt', data.txid || '');
    }

    res.json({ success: true });
  } catch (error) {
    console.error('[USDT Webhook] 处理失败:', error);
    res.status(500).json({ success: false });
  }
});

// ============ 查询支付状态 ============
router.get('/check/:orderNo', async (req, res) => {
  try {
    const orders = await db.query(
      'SELECT order_no, status, amount, payment_method, paid_at FROM orders WHERE order_no = ?',
      [req.params.orderNo]
    );

    if (orders.length === 0) {
      return res.json({ success: false, message: '订单不存在' });
    }

    res.json({ success: true, data: orders[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: '查询失败' });
  }
});

// ============ 支付成功处理（核心） ============
async function handlePaymentSuccess(orderNo, paymentMethod, tradeNo) {
  return db.transaction(async (conn) => {
    // 获取订单
    const orders = await conn.query("SELECT * FROM orders WHERE order_no = ? AND status IN ('pending', 'processing')", [orderNo]);
    if (orders.length === 0) return { success: false, message: '订单不存在或已处理' };

    const order = orders[0];

    // 更新订单状态
    await conn.execute(
      "UPDATE orders SET status = 'completed', payment_method = ?, payment_trade_no = ?, paid_at = NOW() WHERE order_no = ?",
      [paymentMethod, tradeNo, orderNo]
    );

    // 获取用户和套餐
    const users = await conn.query('SELECT * FROM users WHERE id = ?', [order.user_id]);
    if (users.length === 0) return { success: false, message: '用户不存在' };

    const plans = await conn.query('SELECT * FROM plans WHERE id = ?', [order.plan_id]);
    if (plans.length === 0) return { success: false, message: '套餐不存在' };

    const user = users[0];
    const plan = plans[0];

    // 计算到期时间
    const now = new Date();
    let expireDate;
    if (user.plan_expire_at && new Date(user.plan_expire_at) > now) {
      expireDate = new Date(new Date(user.plan_expire_at).getTime() + plan.duration_days * 24 * 60 * 60 * 1000);
    } else {
      expireDate = new Date(now.getTime() + plan.duration_days * 24 * 60 * 60 * 1000);
    }

    // 生成订阅令牌
    const subscriptionToken = user.subscription_token || crypto.randomBytes(32).toString('hex');

    // 更新用户信息
    await conn.execute(
      'UPDATE users SET plan_id = ?, plan_expire_at = ?, status = ?, subscription_token = ? WHERE id = ?',
      [plan.id, expireDate.toISOString().split('T')[0], 'active', subscriptionToken, user.id]
    );

    return {
      success: true,
      message: '套餐已开通',
      data: {
        userId: user.id,
        planName: plan.name,
        expireDate: expireDate.toISOString().split('T')[0],
        subscriptionUrl: `${process.env.BASE_URL || 'http://localhost:3000'}/api/sub/${subscriptionToken}`,
      },
    };
  });
}

module.exports = router;
