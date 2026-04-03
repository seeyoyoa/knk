// 支付宝当面付服务
const crypto = require('crypto');
const { get, run, query } = require('../config/database');
const { logPayment } = require('./payment');

// 支付宝API地址
const ALIPAY_GATEWAY = 'https://openapi.alipay.com/gateway.do';

/**
 * 构建支付宝请求参数
 */
function buildAlipayParams(method, bizContent, config) {
  const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
  const params = {
    app_id: config.appId,
    method,
    charset: 'utf-8',
    sign_type: 'RSA2',
    timestamp,
    version: '1.0',
    biz_content: JSON.stringify(bizContent),
    notify_url: config.notifyUrl
  };
  return params;
}

/**
 * RSA2签名
 */
function sign(params, privateKey) {
  const sortedKeys = Object.keys(params).sort();
  const queryString = sortedKeys
    .map(key => `${key}=${params[key]}`)
    .join('&');
  
  const sign = crypto.createSign('RSA-SHA256');
  sign.update(queryString, 'utf8');
  return sign.sign(privateKey, 'base64');
}

/**
 * 验证支付宝回调签名
 */
function verifyAlipaySign(params, publicKey) {
  const { sign, sign_type, ...restParams } = params;
  const sortedKeys = Object.keys(restParams).sort();
  const queryString = sortedKeys
    .map(key => `${key}=${restParams[key]}`)
    .join('&');
  
  const verify = crypto.createVerify('RSA-SHA256');
  verify.update(queryString, 'utf8');
  return verify.verify(publicKey, sign, 'base64');
}

/**
 * 发起当面付请求
 */
async function createFacePayOrder(orderId, userId, amount, subject, config) {
  try {
    const outTradeNo = `ALIPAY_${orderId}_${Date.now()}`;
    
    const bizContent = {
      out_trade_no: outTradeNo,
      total_amount: amount.toFixed(2),
      subject: subject,
      body: `订单${orderId}支付`,
      timeout_express: '15m',
      product_code: 'FACE_TO_FACE_PAYMENT'
    };

    const params = buildAlipayParams('alipay.trade.precreate', bizContent, config);
    params.sign = sign(params, config.privateKey);

    // 构建请求URL
    const queryString = Object.keys(params)
      .map(key => `${key}=${encodeURIComponent(params[key])}`)
      .join('&');
    const url = `${ALIPAY_GATEWAY}?${queryString}`;

    // 发送请求
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });

    const data = await response.json();
    const alipayResponse = data.alipay_trade_precreate_response;

    if (alipayResponse.code === '10000') {
      // 保存支付记录
      await run(`
        INSERT INTO payments (id, order_id, user_id, amount, currency, method, status, trade_no, qr_code, created_at)
        VALUES (?, ?, ?, ?, 'CNY', 'alipay', 'pending', ?, ?, CURRENT_TIMESTAMP)
      `, [
        crypto.randomUUID(),
        orderId,
        userId,
        amount,
        outTradeNo,
        alipayResponse.qr_code
      ]);

      // 更新订单
      await run(`
        UPDATE orders SET payment_method = 'alipay', payment_trade_no = ? WHERE id = ?
      `, [outTradeNo, orderId]);

      await logPayment('alipay', '订单创建成功', {
        orderId,
        outTradeNo,
        amount,
        qrCode: alipayResponse.qr_code
      });

      return {
        success: true,
        outTradeNo,
        qrCode: alipayResponse.qr_code,
        orderId
      };
    } else {
      throw new Error(alipayResponse.msg || '支付宝创建订单失败');
    }
  } catch (error) {
    await logPayment('alipay', '订单创建失败', {
      orderId,
      error: error.message
    });
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * 查询订单状态
 */
async function queryOrderStatus(outTradeNo, config) {
  try {
    const bizContent = {
      out_trade_no: outTradeNo
    };

    const params = buildAlipayParams('alipay.trade.query', bizContent, config);
    params.sign = sign(params, config.privateKey);

    const queryString = Object.keys(params)
      .map(key => `${key}=${encodeURIComponent(params[key])}`)
      .join('&');
    const url = `${ALIPAY_GATEWAY}?${queryString}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });

    const data = await response.json();
    const alipayResponse = data.alipay_trade_query_response;

    return {
      success: alipayResponse.code === '10000',
      tradeStatus: alipayResponse.trade_status,
      outTradeNo: alipayResponse.out_trade_no,
      tradeNo: alipayResponse.trade_no,
      totalAmount: alipayResponse.total_amount,
      buyerLogonId: alipayResponse.buyer_logon_id
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * 处理支付宝异步回调
 */
async function handleNotify(notifyData, config) {
  try {
    // 验证签名
    const isValid = verifyAlipaySign(notifyData, config.alipayPublicKey);
    if (!isValid) {
      console.error('支付宝回调签名验证失败');
      return { success: false, message: '签名验证失败' };
    }

    const {
      out_trade_no,
      trade_no,
      trade_status,
      total_amount,
      buyer_id,
      buyer_logon_id,
      gmt_payment
    } = notifyData;

    // 根据交易状态处理
    if (trade_status === 'TRADE_SUCCESS' || trade_status === 'TRADE_FINISHED') {
      // 更新支付记录
      await run(`
        UPDATE payments 
        SET status = 'confirmed', trade_no = ?, paid_at = ?, confirmed_at = CURRENT_TIMESTAMP,
            notify_data = ?
        WHERE trade_no = ?
      `, [trade_no, gmt_payment, JSON.stringify(notifyData), out_trade_no]);

      // 更新订单状态
      const payment = await get(`
        SELECT order_id FROM payments WHERE trade_no = ?
      `, [out_trade_no]);

      if (payment) {
        await run(`
          UPDATE orders 
          SET status = 'paid', paid_at = ? 
          WHERE id = ?
        `, [gmt_payment, payment.order_id]);

        // 触发套餐开通
        await activatePlan(payment.order_id);
      }

      await logPayment('alipay', '支付成功', {
        outTradeNo: out_trade_no,
        tradeNo: trade_no,
        amount: total_amount,
        buyerId: buyer_id
      });

      return { success: true };
    }

    return { success: true, message: '状态已处理' };
  } catch (error) {
    console.error('处理支付宝回调失败:', error);
    return { success: false, message: error.message };
  }
}

/**
 * 开通套餐
 */
async function activatePlan(orderId) {
  try {
    const order = await get(`
      SELECT o.*, p.duration, p.data_limit, p.speed_limit, p.node_groups
      FROM orders o
      JOIN plans p ON o.plan_id = p.id
      WHERE o.id = ?
    `, [orderId]);

    if (!order) {
      throw new Error('订单不存在');
    }

    const expireDate = new Date();
    expireDate.setDate(expireDate.getDate() + order.duration);

    // 更新用户套餐
    await run(`
      UPDATE users 
      SET plan_id = ?, 
          plan_expire = ?, 
          data_limit = ?, 
          status = 'active'
      WHERE id = ?
    `, [order.plan_id, expireDate.toISOString(), order.data_limit, order.user_id]);

    await logPayment('system', '套餐开通成功', {
      orderId,
      userId: order.user_id,
      planId: order.plan_id,
      expireDate: expireDate.toISOString()
    });

    return true;
  } catch (error) {
    console.error('开通套餐失败:', error);
    await logPayment('system', '套餐开通失败', {
      orderId,
      error: error.message
    });
    throw error;
  }
}

module.exports = {
  createFacePayOrder,
  queryOrderStatus,
  handleNotify,
  verifyAlipaySign
};
