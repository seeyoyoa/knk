// 用户路由
const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { get, run, query } = require('../config/database');
const { logPayment, getOrderDetail, getUserOrders } = require('../services/payment');
const { generateSubscriptionLink } = require('../services/subscription');

// ==================== 用户认证 ====================

/**
 * 用户注册
 * POST /api/user/register
 */
router.post('/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;

    // 检查用户名是否存在
    const existing = await get(`SELECT id FROM users WHERE username = ?`, [username]);
    if (existing) {
      return res.status(400).json({
        success: false,
        message: '用户名已存在'
      });
    }

    const userId = crypto.randomUUID();
    const hashedPassword = crypto.createHash('sha256').update(password).digest('hex');
    const subscriptionToken = crypto.randomBytes(16).toString('hex');

    await run(`
      INSERT INTO users (id, username, email, password, subscription_token, status)
      VALUES (?, ?, ?, ?, ?, 'active')
    `, [userId, username, email, hashedPassword, subscriptionToken]);

    await logPayment('user', '用户注册', { userId, username });

    return res.json({
      success: true,
      data: {
        id: userId,
        username,
        subscriptionToken
      }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: '注册失败',
      error: error.message
    });
  }
});

/**
 * 用户登录
 * POST /api/user/login
 */
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const hashedPassword = crypto.createHash('sha256').update(password).digest('hex');

    const user = await get(`
      SELECT id, username, email, balance, plan_id, plan_expire, data_used, data_limit, 
             subscription_token, status, created_at, last_login
      FROM users 
      WHERE username = ? AND password = ?
    `, [username, hashedPassword]);

    if (!user) {
      return res.status(401).json({
        success: false,
        message: '用户名或密码错误'
      });
    }

    // 更新最后登录时间
    await run(`UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?`, [user.id]);

    // 获取套餐信息
    let plan = null;
    if (user.plan_id) {
      plan = await get(`SELECT * FROM plans WHERE id = ?`, [user.plan_id]);
    }

    // 获取订阅链接
    const subscriptionUrl = generateSubscriptionLink(user.subscription_token);

    await logPayment('user', '用户登录', { userId: user.id, username });

    return res.json({
      success: true,
      data: {
        ...user,
        plan,
        subscriptionUrl
      }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: '登录失败',
      error: error.message
    });
  }
});

// ==================== 用户信息 ====================

/**
 * 获取用户信息
 * GET /api/user/profile/:userId
 */
router.get('/profile/:userId', async (req, res) => {
  try {
    const user = await get(`
      SELECT u.*, p.name as plan_name, p.duration, p.data_limit as plan_data_limit,
             p.speed_limit, p.features
      FROM users u
      LEFT JOIN plans p ON u.plan_id = p.id
      WHERE u.id = ?
    `, [req.params.userId]);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: '用户不存在'
      });
    }

    // 获取订阅链接
    const subscriptionUrl = generateSubscriptionLink(user.subscription_token);

    return res.json({
      success: true,
      data: {
        ...user,
        subscriptionUrl
      }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: '获取用户信息失败',
      error: error.message
    });
  }
});

// ==================== 订单管理 ====================

/**
 * 创建订单
 * POST /api/user/order
 */
router.post('/order', async (req, res) => {
  try {
    const { userId, planId } = req.body;

    // 获取套餐信息
    const plan = await get(`SELECT * FROM plans WHERE id = ? AND is_active = 1`, [planId]);
    if (!plan) {
      return res.status(404).json({
        success: false,
        message: '套餐不存在或已下架'
      });
    }

    // 检查用户是否存在
    const user = await get(`SELECT id FROM users WHERE id = ?`, [userId]);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: '用户不存在'
      });
    }

    const orderId = crypto.randomUUID();

    // 创建订单
    await run(`
      INSERT INTO orders (id, user_id, plan_id, amount, status)
      VALUES (?, ?, ?, ?, 'pending')
    `, [orderId, userId, planId, plan.price]);

    await logPayment('user', '创建订单', {
      orderId,
      userId,
      planId,
      amount: plan.price
    });

    return res.json({
      success: true,
      data: {
        orderId,
        planName: plan.name,
        amount: plan.price,
        duration: plan.duration
      }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: '创建订单失败',
      error: error.message
    });
  }
});

/**
 * 获取用户订单
 * GET /api/user/orders/:userId
 */
router.get('/orders/:userId', async (req, res) => {
  try {
    const { limit = 20, offset = 0 } = req.query;
    const orders = await getUserOrders(req.params.userId, parseInt(limit), parseInt(offset));

    return res.json({ success: true, data: orders });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: '获取订单列表失败',
      error: error.message
    });
  }
});

// ==================== 订阅链接 ====================

/**
 * 获取用户订阅链接
 * GET /api/user/subscription/:token
 */
router.get('/subscription/:token', async (req, res) => {
  try {
    const user = await get(`
      SELECT u.*, p.node_groups
      FROM users u
      LEFT JOIN plans p ON u.plan_id = p.id
      WHERE u.subscription_token = ?
    `, [req.params.token]);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: '无效的订阅token'
      });
    }

    // 获取用户可用的节点
    const nodes = await query(`
      SELECT n.* FROM nodes n
      JOIN plan_nodes pn ON n.id = pn.node_id
      WHERE pn.plan_id = ? AND n.is_active = 1
      ORDER BY pn.priority DESC
    `, [user.plan_id || '']);

    const subscriptionUrl = generateSubscriptionLink(user.subscription_token);

    return res.json({
      success: true,
      data: {
        subscriptionUrl,
        nodeCount: nodes.length,
        userInfo: {
          username: user.username,
          planExpire: user.plan_expire,
          dataUsed: user.data_used,
          dataLimit: user.data_limit
        }
      }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: '获取订阅链接失败',
      error: error.message
    });
  }
});

// ==================== 节点列表 ====================

/**
 * 获取可用节点列表
 * GET /api/user/nodes/:userId
 */
router.get('/nodes/:userId', async (req, res) => {
  try {
    const user = await get(`SELECT plan_id FROM users WHERE id = ?`, [req.params.userId]);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: '用户不存在'
      });
    }

    const nodes = await query(`
      SELECT n.*, pn.custom_name, pn.priority
      FROM nodes n
      JOIN plan_nodes pn ON n.id = pn.node_id
      WHERE pn.plan_id = ? AND n.is_active = 1
      ORDER BY pn.priority DESC, n.country
    `, [user.plan_id || '']);

    return res.json({ success: true, data: nodes });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: '获取节点列表失败',
      error: error.message
    });
  }
});

module.exports = router;
