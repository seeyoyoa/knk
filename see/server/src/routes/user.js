/**
 * 用户路由 - 用户面板相关操作
 */
const express = require('express');
const db = require('../config/database');
const { generateToken } = require('../middleware/auth');

const router = express.Router();

// ============ 获取用户信息 ============
router.get('/profile', async (req, res) => {
  try {
    const user = req.user;
    
    // 获取套餐信息
    let plan = null;
    if (user.plan_id) {
      const plans = await db.query('SELECT * FROM plans WHERE id = ?', [user.plan_id]);
      if (plans.length > 0) {
        plan = plans[0];
        // 获取套餐特性
        const features = await db.query('SELECT feature FROM plan_features WHERE plan_id = ? ORDER BY sort_order', [plan.id]);
        plan.features = features.map(f => f.feature);
        // 获取节点组
        const groups = await db.query('SELECT node_group FROM plan_node_groups WHERE plan_id = ?', [plan.id]);
        plan.nodeGroups = groups.map(g => g.node_group);
      }
    }

    res.json({
      success: true,
      data: {
        id: user.id,
        username: user.username,
        email: user.email,
        balance: user.balance,
        plan,
        planExpire: user.plan_expire_at,
        dataUsed: user.data_used,
        subscriptionToken: user.subscription_token,
        status: user.status,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: '获取用户信息失败' });
  }
});

// ============ 获取用户订单 ============
router.get('/orders', async (req, res) => {
  try {
    const orders = await db.query(
      `SELECT o.*, p.name as plan_name 
       FROM orders o 
       LEFT JOIN plans p ON o.plan_id = p.id 
       WHERE o.user_id = ? 
       ORDER BY o.created_at DESC 
       LIMIT 50`,
      [req.user.id]
    );

    res.json({ success: true, data: orders });
  } catch (error) {
    res.status(500).json({ success: false, message: '获取订单失败' });
  }
});

// ============ 创建订单 ============
router.post('/order', async (req, res) => {
  try {
    const { planId, paymentMethod } = req.body;

    if (!planId || !paymentMethod) {
      return res.status(400).json({ success: false, message: '缺少必要参数' });
    }

    // 获取套餐信息
    const plans = await db.query('SELECT * FROM plans WHERE id = ? AND is_active = 1', [planId]);
    if (plans.length === 0) {
      return res.status(404).json({ success: false, message: '套餐不存在或已下架' });
    }

    const plan = plans[0];
    const orderNo = `ORD${Date.now()}${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
    const expiredAt = new Date(Date.now() + 30 * 60 * 1000); // 30分钟过期

    const [result] = await db.execute(
      'INSERT INTO orders (order_no, user_id, plan_id, amount, payment_method, status, expired_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [orderNo, req.user.id, plan.id, plan.price, paymentMethod, 'pending', expiredAt]
    );

    res.json({
      success: true,
      data: {
        orderId: result.insertId,
        orderNo,
        amount: plan.price,
        planName: plan.name,
        expiredAt,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: '创建订单失败' });
  }
});

// ============ 获取用户可用节点 ============
router.get('/nodes', async (req, res) => {
  try {
    const user = req.user;
    
    if (!user.plan_id) {
      return res.json({ success: true, data: [] });
    }

    // 获取用户套餐的节点组
    const groups = await db.query('SELECT node_group FROM plan_node_groups WHERE plan_id = ?', [user.plan_id]);
    if (groups.length === 0) {
      return res.json({ success: true, data: [] });
    }

    const groupNames = groups.map(g => g.node_group);
    const placeholders = groupNames.map(() => '?').join(',');

    // 获取节点
    const nodes = await db.query(
      `SELECT n.*, pn.custom_name, pn.priority 
       FROM nodes n 
       INNER JOIN plan_nodes pn ON n.id = pn.node_id 
       WHERE pn.plan_id = ? AND n.is_active = 1 
       ORDER BY pn.priority ASC`,
      [user.plan_id]
    );

    res.json({ success: true, data: nodes });
  } catch (error) {
    res.status(500).json({ success: false, message: '获取节点失败' });
  }
});

// ============ 更新用户资料 ============
router.put('/profile', async (req, res) => {
  try {
    const { username, email } = req.body;
    const updates = [];
    const values = [];

    if (username) {
      updates.push('username = ?');
      values.push(username);
    }
    if (email) {
      updates.push('email = ?');
      values.push(email);
    }

    if (updates.length === 0) {
      return res.status(400).json({ success: false, message: '没有需要更新的字段' });
    }

    values.push(req.user.id);
    await db.execute(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, values);

    res.json({ success: true, message: '更新成功' });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ success: false, message: '用户名或邮箱已存在' });
    }
    res.status(500).json({ success: false, message: '更新失败' });
  }
});

// ============ 修改密码 ============
router.put('/password', async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;

    if (!oldPassword || !newPassword) {
      return res.status(400).json({ success: false, message: '请提供旧密码和新密码' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ success: false, message: '新密码至少需要6个字符' });
    }

    // 验证旧密码
    const users = await db.query('SELECT password_hash FROM users WHERE id = ?', [req.user.id]);
    const bcrypt = require('bcrypt');
    const isValid = await bcrypt.compare(oldPassword, users[0].password_hash);

    if (!isValid) {
      return res.status(400).json({ success: false, message: '旧密码不正确' });
    }

    // 更新密码
    const saltRounds = parseInt(process.env.BCRYPT_ROUNDS || '10');
    const hash = await bcrypt.hash(newPassword, saltRounds);
    await db.execute('UPDATE users SET password_hash = ? WHERE id = ?', [hash, req.user.id]);

    res.json({ success: true, message: '密码修改成功' });
  } catch (error) {
    res.status(500).json({ success: false, message: '修改密码失败' });
  }
});

module.exports = router;
