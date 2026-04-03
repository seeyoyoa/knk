// 管理员路由
const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { get, run, query } = require('../config/database');
const { logPayment } = require('../services/payment');

// 中间件：验证管理员token
function verifyAdmin(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) {
    return res.status(401).json({ success: false, message: '未授权' });
  }

  // 简单token验证（实际应使用JWT）
  const [username, timestamp] = Buffer.from(token, 'base64').toString().split(':');
  const age = Date.now() - parseInt(timestamp);
  
  if (age > 24 * 60 * 60 * 1000) { // 24小时过期
    return res.status(401).json({ success: false, message: 'token已过期' });
  }

  req.adminUsername = username;
  next();
}

// ==================== 管理员认证 ====================

/**
 * 管理员登录
 * POST /api/admin/login
 * Body: { username, password }
 */
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const hashedPassword = crypto.createHash('sha256').update(password).digest('hex');

    const admin = await get(`
      SELECT * FROM admins WHERE username = ? AND password = ?
    `, [username, hashedPassword]);

    if (!admin) {
      return res.status(401).json({
        success: false,
        message: '用户名或密码错误'
      });
    }

    // 更新最后登录时间
    await run(`
      UPDATE admins SET last_login = CURRENT_TIMESTAMP WHERE id = ?
    `, [admin.id]);

    // 生成token
    const token = Buffer.from(`${admin.username}:${Date.now()}`).toString('base64');

    await logPayment('admin', '管理员登录', { username });

    return res.json({
      success: true,
      data: {
        id: admin.id,
        username: admin.username,
        role: admin.role,
        token
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

// ==================== 用户管理 ====================

/**
 * 获取用户列表
 * GET /api/admin/users
 */
router.get('/users', verifyAdmin, async (req, res) => {
  try {
    const { limit = 50, offset = 0, status } = req.query;
    let sql = `
      SELECT u.*, p.name as plan_name 
      FROM users u 
      LEFT JOIN plans p ON u.plan_id = p.id
    `;
    const params = [];

    if (status) {
      sql += ' WHERE u.status = ?';
      params.push(status);
    }

    sql += ' ORDER BY u.created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));

    const users = await query(sql, params);
    return res.json({ success: true, data: users });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: '获取用户列表失败',
      error: error.message
    });
  }
});

/**
 * 创建用户
 * POST /api/admin/users
 */
router.post('/users', verifyAdmin, async (req, res) => {
  try {
    const { username, email, phone, password, balance } = req.body;
    const userId = crypto.randomUUID();
    const hashedPassword = crypto.createHash('sha256').update(password).digest('hex');
    const subscriptionToken = crypto.randomBytes(16).toString('hex');

    await run(`
      INSERT INTO users (id, username, email, phone, password, balance, subscription_token)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [userId, username, email, phone, hashedPassword, balance || 0, subscriptionToken]);

    await logPayment('admin', '创建用户', { username, userId });

    return res.json({
      success: true,
      data: { id: userId, username, subscriptionToken }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: '创建用户失败',
      error: error.message
    });
  }
});

/**
 * 更新用户状态
 * PUT /api/admin/users/:id/status
 */
router.put('/users/:id/status', verifyAdmin, async (req, res) => {
  try {
    const { status } = req.body;
    await run(`UPDATE users SET status = ? WHERE id = ?`, [status, req.params.id]);
    
    await logPayment('admin', '更新用户状态', { userId: req.params.id, status });
    
    return res.json({ success: true });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: '更新用户状态失败',
      error: error.message
    });
  }
});

// ==================== 套餐管理 ====================

/**
 * 获取套餐列表
 * GET /api/admin/plans
 */
router.get('/plans', async (req, res) => {
  try {
    const plans = await query(`
      SELECT * FROM plans ORDER BY price ASC
    `);
    return res.json({ success: true, data: plans });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: '获取套餐列表失败',
      error: error.message
    });
  }
});

/**
 * 创建套餐
 * POST /api/admin/plans
 */
router.post('/plans', verifyAdmin, async (req, res) => {
  try {
    const { name, price, duration, dataLimit, speedLimit, features, isPopular } = req.body;
    const planId = crypto.randomUUID();

    await run(`
      INSERT INTO plans (id, name, price, duration, data_limit, speed_limit, features, is_popular)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [planId, name, price, duration, dataLimit, speedLimit, JSON.stringify(features), isPopular ? 1 : 0]);

    await logPayment('admin', '创建套餐', { planId, name });

    return res.json({ success: true, data: { id: planId } });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: '创建套餐失败',
      error: error.message
    });
  }
});

// ==================== 节点管理 ====================

/**
 * 获取节点列表
 * GET /api/admin/nodes
 */
router.get('/nodes', async (req, res) => {
  try {
    const nodes = await query(`
      SELECT * FROM nodes ORDER BY country, name
    `);
    return res.json({ success: true, data: nodes });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: '获取节点列表失败',
      error: error.message
    });
  }
});

/**
 * 批量更新节点
 * POST /api/admin/nodes/batch
 */
router.post('/nodes/batch', verifyAdmin, async (req, res) => {
  try {
    const { nodeIds, action, data } = req.body;

    if (action === 'activate') {
      for (const nodeId of nodeIds) {
        await run(`UPDATE nodes SET is_active = 1 WHERE id = ?`, [nodeId]);
      }
    } else if (action === 'deactivate') {
      for (const nodeId of nodeIds) {
        await run(`UPDATE nodes SET is_active = 0 WHERE id = ?`, [nodeId]);
      }
    } else if (action === 'rename') {
      for (const nodeId of nodeIds) {
        await run(`UPDATE nodes SET custom_name = ? WHERE id = ?`, [data.customName, nodeId]);
      }
    } else if (action === 'assign') {
      for (const nodeId of nodeIds) {
        await run(`
          INSERT OR IGNORE INTO plan_nodes (plan_id, node_id, priority)
          VALUES (?, ?, ?)
        `, [data.planId, nodeId, data.priority || 0]);
      }
    }

    await logPayment('admin', '批量更新节点', { action, nodeIds });

    return res.json({ success: true });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: '批量更新节点失败',
      error: error.message
    });
  }
});

// ==================== 订阅源管理 ====================

/**
 * 获取订阅源列表
 * GET /api/admin/subscriptions
 */
router.get('/subscriptions', async (req, res) => {
  try {
    const subscriptions = await query(`
      SELECT * FROM subscriptions ORDER BY created_at DESC
    `);
    return res.json({ success: true, data: subscriptions });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: '获取订阅源列表失败',
      error: error.message
    });
  }
});

/**
 * 添加订阅源
 * POST /api/admin/subscriptions
 */
router.post('/subscriptions', verifyAdmin, async (req, res) => {
  try {
    const { name, url, source } = req.body;
    const subId = crypto.randomUUID();

    await run(`
      INSERT INTO subscriptions (id, name, url, source)
      VALUES (?, ?, ?, ?)
    `, [subId, name, url, source]);

    await logPayment('admin', '添加订阅源', { subId, name });

    return res.json({ success: true, data: { id: subId } });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: '添加订阅源失败',
      error: error.message
    });
  }
});

// ==================== 仪表盘统计 ====================

/**
 * 获取仪表盘统计数据
 * GET /api/admin/dashboard
 */
router.get('/dashboard', async (req, res) => {
  try {
    const totalUsers = await get(`SELECT COUNT(*) as count FROM users`);
    const activeUsers = await get(`SELECT COUNT(*) as count FROM users WHERE status = 'active'`);
    const totalNodes = await get(`SELECT COUNT(*) as count FROM nodes`);
    const activeNodes = await get(`SELECT COUNT(*) as count FROM nodes WHERE is_active = 1`);
    const totalSubscriptions = await get(`SELECT COUNT(*) as count FROM subscriptions`);
    
    const revenue = await get(`
      SELECT SUM(amount) as total FROM orders WHERE status = 'paid'
    `);

    return res.json({
      success: true,
      data: {
        totalUsers: totalUsers.count,
        activeUsers: activeUsers.count,
        totalRevenue: revenue.total || 0,
        totalNodes: totalNodes.count,
        activeNodes: activeNodes.count,
        subscriptionCount: totalSubscriptions.count
      }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: '获取统计数据失败',
      error: error.message
    });
  }
});

module.exports = router;
