// 通用支付工具
const { get, run, query } = require('../config/database');

/**
 * 记录支付日志
 */
async function logPayment(type, message, data = {}) {
  try {
    await run(`
      INSERT INTO logs (type, message, data, created_at)
      VALUES (?, ?, ?, CURRENT_TIMESTAMP)
    `, [type, message, JSON.stringify(data)]);
    console.log(`[${type}] ${message}`, data);
  } catch (error) {
    console.error('记录日志失败:', error);
  }
}

/**
 * 获取支付配置
 */
async function getPaymentConfig(type) {
  try {
    const configs = await query(`
      SELECT config_key, config_value, is_encrypted
      FROM payment_config 
      WHERE config_type = ?
    `, [type]);

    const config = {};
    configs.forEach(row => {
      config[row.config_key] = row.config_value;
    });
    return config;
  } catch (error) {
    console.error('获取支付配置失败:', error);
    return null;
  }
}

/**
 * 保存支付配置
 */
async function savePaymentConfig(type, config) {
  try {
    for (const [key, value] of Object.entries(config)) {
      await run(`
        INSERT INTO payment_config (id, config_type, config_key, config_value, updated_at)
        VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(config_type, config_key) 
        DO UPDATE SET config_value = ?, updated_at = CURRENT_TIMESTAMP
      `, [`${type}_${key}`, type, key, value, value]);
    }
    return true;
  } catch (error) {
    console.error('保存支付配置失败:', error);
    return false;
  }
}

/**
 * 检查支付超时
 */
async function checkPaymentTimeout(orderId, timeoutMinutes = 15) {
  try {
    const order = await get(`
      SELECT *, 
        (julianday(CURRENT_TIMESTAMP) - julianday(created_at)) * 24 * 60 as minutes_elapsed
      FROM orders 
      WHERE id = ? AND status = 'pending'
    `, [orderId]);

    if (order && order.minutes_elapsed > timeoutMinutes) {
      await run(`
        UPDATE orders SET status = 'cancelled' WHERE id = ?
      `, [orderId]);

      await run(`
        UPDATE payments SET status = 'expired' WHERE order_id = ?
      `, [orderId]);

      await logPayment('system', '订单超时取消', { orderId });
      return true;
    }
    return false;
  } catch (error) {
    console.error('检查支付超时失败:', error);
    return false;
  }
}

/**
 * 获取订单详情
 */
async function getOrderDetail(orderId) {
  try {
    const order = await get(`
      SELECT o.*, u.username, u.email, p.name as plan_name, p.duration, p.data_limit
      FROM orders o
      JOIN users u ON o.user_id = u.id
      JOIN plans p ON o.plan_id = p.id
      WHERE o.id = ?
    `, [orderId]);

    if (!order) return null;

    const payment = await get(`
      SELECT * FROM payments WHERE order_id = ?
      ORDER BY created_at DESC LIMIT 1
    `, [orderId]);

    return {
      ...order,
      payment
    };
  } catch (error) {
    console.error('获取订单详情失败:', error);
    return null;
  }
}

/**
 * 获取用户订单列表
 */
async function getUserOrders(userId, limit = 20, offset = 0) {
  try {
    return await query(`
      SELECT o.*, p.name as plan_name, p.duration, p.data_limit
      FROM orders o
      JOIN plans p ON o.plan_id = p.id
      WHERE o.user_id = ?
      ORDER BY o.created_at DESC
      LIMIT ? OFFSET ?
    `, [userId, limit, offset]);
  } catch (error) {
    console.error('获取用户订单失败:', error);
    return [];
  }
}

/**
 * 获取所有订单（管理员）
 */
async function getAllOrders(limit = 50, offset = 0, status = null) {
  try {
    let sql = `
      SELECT o.*, u.username, u.email, p.name as plan_name
      FROM orders o
      JOIN users u ON o.user_id = u.id
      JOIN plans p ON o.plan_id = p.id
    `;
    const params = [];

    if (status) {
      sql += ' WHERE o.status = ?';
      params.push(status);
    }

    sql += ' ORDER BY o.created_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    return await query(sql, params);
  } catch (error) {
    console.error('获取所有订单失败:', error);
    return [];
  }
}

/**
 * 统计收入
 */
async function getRevenueStats(period = 'month') {
  try {
    let dateFilter = '';
    if (period === 'today') {
      dateFilter = "DATE(created_at) = DATE('now')";
    } else if (period === 'week') {
      dateFilter = "created_at >= DATE('now', '-7 days')";
    } else if (period === 'month') {
      dateFilter = "created_at >= DATE('now', '-1 month')";
    }

    const stats = await get(`
      SELECT 
        COUNT(*) as total_orders,
        SUM(CASE WHEN status = 'paid' THEN amount ELSE 0 END) as total_revenue,
        SUM(CASE WHEN status = 'paid' AND payment_method = 'alipay' THEN amount ELSE 0 END) as alipay_revenue,
        SUM(CASE WHEN status = 'paid' AND payment_method = 'usdt' THEN amount ELSE 0 END) as usdt_revenue,
        COUNT(CASE WHEN status = 'paid' THEN 1 END) as paid_orders,
        COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_orders
      FROM orders
      ${dateFilter ? `WHERE ${dateFilter}` : ''}
    `);

    return stats;
  } catch (error) {
    console.error('统计收入失败:', error);
    return {
      total_orders: 0,
      total_revenue: 0,
      alipay_revenue: 0,
      usdt_revenue: 0,
      paid_orders: 0,
      pending_orders: 0
    };
  }
}

module.exports = {
  logPayment,
  getPaymentConfig,
  savePaymentConfig,
  checkPaymentTimeout,
  getOrderDetail,
  getUserOrders,
  getAllOrders,
  getRevenueStats
};
