// 支付路由
const express = require('express');
const router = express.Router();
const alipayService = require('../services/alipay');
const usdtService = require('../services/usdt');
const {
  getPaymentConfig,
  savePaymentConfig,
  checkPaymentTimeout,
  getOrderDetail,
  getUserOrders,
  getAllOrders,
  getRevenueStats,
  logPayment
} = require('../services/payment');
const { get, run, query } = require('../config/database');

// ==================== 支付宝相关接口 ====================

/**
 * 创建支付宝当面付订单
 * POST /api/payment/alipay/create
 * Body: { orderId, userId, amount, subject }
 */
router.post('/alipay/create', async (req, res) => {
  try {
    const { orderId, userId, amount, subject } = req.body;

    if (!orderId || !userId || !amount) {
      return res.status(400).json({
        success: false,
        message: '缺少必要参数'
      });
    }

    // 获取支付宝配置
    const config = await getPaymentConfig('alipay');
    if (!config || !config.enabled) {
      return res.status(400).json({
        success: false,
        message: '支付宝支付未启用'
      });
    }

    // 检查订单超时
    const isTimeout = await checkPaymentTimeout(orderId, parseInt(config.timeout) || 15);
    if (isTimeout) {
      return res.status(400).json({
        success: false,
        message: '订单已超时'
      });
    }

    // 创建支付宝订单
    const result = await alipayService.createFacePayOrder(
      orderId,
      userId,
      amount,
      subject || '订阅套餐购买',
      {
        appId: config.appId,
        privateKey: config.privateKey,
        alipayPublicKey: config.alipayPublicKey,
        notifyUrl: config.notifyUrl,
        sellerEmail: config.sellerEmail
      }
    );

    if (result.success) {
      return res.json(result);
    } else {
      return res.status(500).json(result);
    }
  } catch (error) {
    await logPayment('alipay', '创建订单异常', { error: error.message });
    return res.status(500).json({
      success: false,
      message: '创建支付宝订单失败',
      error: error.message
    });
  }
});

/**
 * 支付宝异步回调通知
 * POST /api/payment/alipay/notify
 */
router.post('/alipay/notify', async (req, res) => {
  try {
    const notifyData = req.body;

    // 获取支付宝配置
    const config = await getPaymentConfig('alipay');
    if (!config || !config.alipayPublicKey) {
      console.error('支付宝公钥未配置');
      return res.send('failure');
    }

    // 处理回调
    const result = await alipayService.handleNotify(notifyData, {
      alipayPublicKey: config.alipayPublicKey
    });

    if (result.success) {
      // 返回 success 告知支付宝不再重复通知
      return res.send('success');
    } else {
      return res.send('failure');
    }
  } catch (error) {
    console.error('处理支付宝回调异常:', error);
    return res.send('failure');
  }
});

/**
 * 支付宝同步回调（用户支付后跳转）
 * GET /api/payment/alipay/return
 */
router.get('/alipay/return', async (req, res) => {
  try {
    const { out_trade_no, trade_no, trade_status } = req.query;

    if (out_trade_no) {
      // 查询订单状态
      const config = await getPaymentConfig('alipay');
      const status = await alipayService.queryOrderStatus(out_trade_no, {
        appId: config?.appId,
        privateKey: config?.privateKey,
        alipayPublicKey: config?.alipayPublicKey,
        notifyUrl: config?.notifyUrl
      });

      return res.redirect(`${config?.returnUrl || '/'}?status=${trade_status}&order=${out_trade_no}`);
    }

    return res.redirect('/');
  } catch (error) {
    return res.redirect('/?error=payment_check_failed');
  }
});

/**
 * 查询支付宝订单状态
 * POST /api/payment/alipay/query
 * Body: { outTradeNo }
 */
router.post('/alipay/query', async (req, res) => {
  try {
    const { outTradeNo } = req.body;

    if (!outTradeNo) {
      return res.status(400).json({
        success: false,
        message: '缺少交易号'
      });
    }

    const config = await getPaymentConfig('alipay');
    const result = await alipayService.queryOrderStatus(outTradeNo, {
      appId: config?.appId,
      privateKey: config?.privateKey,
      alipayPublicKey: config?.alipayPublicKey,
      notifyUrl: config?.notifyUrl
    });

    return res.json(result);
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: '查询订单失败',
      error: error.message
    });
  }
});

// ==================== USDT相关接口 ====================

/**
 * 创建USDT支付订单
 * POST /api/payment/usdt/create
 * Body: { orderId, userId, amountUSD }
 */
router.post('/usdt/create', async (req, res) => {
  try {
    const { orderId, userId, amountUSD } = req.body;

    if (!orderId || !userId || !amountUSD) {
      return res.status(400).json({
        success: false,
        message: '缺少必要参数'
      });
    }

    // 获取USDT配置
    const config = await getPaymentConfig('usdt');
    if (!config || !config.enabled) {
      return res.status(400).json({
        success: false,
        message: 'USDT支付未启用'
      });
    }

    // 创建USDT订单
    const result = await usdtService.createUSDTOrder(
      orderId,
      userId,
      amountUSD,
      {
        walletAddress: config.walletAddress,
        network: config.network,
        apiKey: config.apiKey,
        timeout: parseInt(config.timeout) || 30
      }
    );

    if (result.success) {
      return res.json(result);
    } else {
      return res.status(500).json(result);
    }
  } catch (error) {
    await logPayment('usdt', '创建订单异常', { error: error.message });
    return res.status(500).json({
      success: false,
      message: '创建USDT订单失败',
      error: error.message
    });
  }
});

/**
 * USDT链上交易回调
 * POST /api/payment/usdt/callback
 */
router.post('/usdt/callback', async (req, res) => {
  try {
    const callbackData = req.body;

    // 获取USDT配置
    const config = await getPaymentConfig('usdt');
    if (!config) {
      return res.status(400).json({
        success: false,
        message: 'USDT配置未找到'
      });
    }

    // 处理回调
    const result = await usdtService.handleUSDTCallback(callbackData, config);

    if (result.success) {
      return res.json({ success: true, message: '支付确认成功' });
    } else {
      return res.status(400).json(result);
    }
  } catch (error) {
    console.error('处理USDT回调异常:', error);
    return res.status(500).json({
      success: false,
      message: '处理USDT回调失败',
      error: error.message
    });
  }
});

/**
 * 查询USDT交易状态
 * POST /api/payment/usdt/query
 * Body: { txHash, network }
 */
router.post('/usdt/query', async (req, res) => {
  try {
    const { txHash, network } = req.body;

    if (!txHash || !network) {
      return res.status(400).json({
        success: false,
        message: '缺少交易哈希或网络类型'
      });
    }

    const config = await getPaymentConfig('usdt');
    const result = await usdtService.checkBlockchainTransaction(
      txHash,
      network,
      config?.walletAddress
    );

    return res.json(result);
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: '查询交易失败',
      error: error.message
    });
  }
});

/**
 * 获取USDT汇率
 * GET /api/payment/usdt/rate
 */
router.get('/usdt/rate', async (req, res) => {
  try {
    const rate = await usdtService.getUSDTExchangeRate();
    return res.json({ success: true, rate });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: '获取汇率失败',
      error: error.message
    });
  }
});

// ==================== 通用支付接口 ====================

/**
 * 获取支付配置
 * GET /api/payment/config
 */
router.get('/config', async (req, res) => {
  try {
    const alipayConfig = await getPaymentConfig('alipay');
    const usdtConfig = await getPaymentConfig('usdt');

    return res.json({
      success: true,
      data: {
        alipay: alipayConfig ? {
          enabled: alipayConfig.enabled === 'true',
          appId: alipayConfig.appId,
          sellerEmail: alipayConfig.sellerEmail
        } : null,
        usdt: usdtConfig ? {
          enabled: usdtConfig.enabled === 'true',
          network: usdtConfig.network,
          walletAddress: usdtConfig.walletAddress,
          minAmount: parseFloat(usdtConfig.minAmount) || 1
        } : null,
        currency: 'CNY',
        exchangeRate: parseFloat(usdtConfig?.exchangeRate) || 7.2,
        timeout: parseInt(usdtConfig?.timeout) || 30
      }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: '获取支付配置失败',
      error: error.message
    });
  }
});

/**
 * 保存支付配置（管理员）
 * POST /api/payment/config
 * Body: { type, config }
 */
router.post('/config', async (req, res) => {
  try {
    const { type, config } = req.body;

    if (!type || !config) {
      return res.status(400).json({
        success: false,
        message: '缺少必要参数'
      });
    }

    const result = await savePaymentConfig(type, config);

    if (result) {
      await logPayment('system', '支付配置更新', { type });
      return res.json({ success: true, message: '配置保存成功' });
    } else {
      return res.status(500).json({
        success: false,
        message: '配置保存失败'
      });
    }
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: '保存配置失败',
      error: error.message
    });
  }
});

/**
 * 查询订单支付状态
 * GET /api/payment/order/:orderId
 */
router.get('/order/:orderId', async (req, res) => {
  try {
    const { orderId } = req.params;
    const order = await getOrderDetail(orderId);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: '订单不存在'
      });
    }

    return res.json({ success: true, data: order });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: '查询订单失败',
      error: error.message
    });
  }
});

/**
 * 用户订单列表
 * GET /api/payment/orders/user/:userId
 */
router.get('/orders/user/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { limit = 20, offset = 0 } = req.query;
    const orders = await getUserOrders(userId, parseInt(limit), parseInt(offset));

    return res.json({ success: true, data: orders });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: '获取订单列表失败',
      error: error.message
    });
  }
});

/**
 * 管理员订单列表
 * GET /api/payment/orders/admin
 */
router.get('/orders/admin', async (req, res) => {
  try {
    const { limit = 50, offset = 0, status } = req.query;
    const orders = await getAllOrders(parseInt(limit), parseInt(offset), status);

    return res.json({ success: true, data: orders });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: '获取订单列表失败',
      error: error.message
    });
  }
});

/**
 * 收入统计
 * GET /api/payment/stats
 */
router.get('/stats', async (req, res) => {
  try {
    const { period = 'month' } = req.query;
    const stats = await getRevenueStats(period);

    return res.json({ success: true, data: stats });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: '获取统计失败',
      error: error.message
    });
  }
});

/**
 * 检查支付状态（轮询用）
 * GET /api/payment/check/:orderId
 */
router.get('/check/:orderId', async (req, res) => {
  try {
    const { orderId } = req.params;
    const order = await getOrderDetail(orderId);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: '订单不存在'
      });
    }

    // 检查超时
    await checkPaymentTimeout(orderId);

    return res.json({
      success: true,
      data: {
        orderId: order.id,
        status: order.status,
        paymentMethod: order.payment_method,
        paidAt: order.paid_at,
        payment: order.payment ? {
          status: order.payment.status,
          qrCode: order.payment.qr_code,
          tradeNo: order.payment.trade_no
        } : null
      }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: '检查支付状态失败',
      error: error.message
    });
  }
});

module.exports = router;
