/**
 * 管理后台路由
 */
const express = require('express');
const bcrypt = require('bcrypt');
const db = require('../config/database');

const router = express.Router();

// ============ 仪表盘统计 ============
router.get('/dashboard', async (req, res) => {
  try {
    const [totalUsers, activeUsers, totalRevenue, totalNodes, activeNodes, subCount, recentOrders] = await Promise.all([
      db.query('SELECT COUNT(*) AS count FROM users'),
      db.query("SELECT COUNT(*) AS count FROM users WHERE status = 'active'"),
      db.query("SELECT COALESCE(SUM(amount), 0) AS total FROM orders WHERE status = 'completed'"),
      db.query('SELECT COUNT(*) AS count FROM nodes'),
      db.query('SELECT COUNT(*) AS count FROM nodes WHERE is_active = 1'),
      db.query('SELECT COUNT(*) AS count FROM subscriptions WHERE is_active = 1'),
      db.query(`SELECT o.*, u.username, p.name as plan_name FROM orders o LEFT JOIN users u ON o.user_id = u.id LEFT JOIN plans p ON o.plan_id = p.id ORDER BY o.created_at DESC LIMIT 10`),
    ]);

    res.json({
      success: true,
      data: {
        stats: {
          totalUsers: totalUsers[0].count,
          activeUsers: activeUsers[0].count,
          totalRevenue: totalRevenue[0].total,
          totalNodes: totalNodes[0].count,
          activeNodes: activeNodes[0].count,
          subscriptionCount: subCount[0].count,
        },
        recentOrders,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: '获取仪表盘数据失败' });
  }
});

// ============ 订阅源管理 ============
router.get('/subscriptions', async (req, res) => {
  try {
    const subs = await db.query('SELECT * FROM subscriptions ORDER BY created_at DESC');
    res.json({ success: true, data: subs });
  } catch (error) {
    res.status(500).json({ success: false, message: '获取订阅源失败' });
  }
});

router.post('/subscriptions', async (req, res) => {
  try {
    const { name, url, source } = req.body;
    if (!name || !url) return res.status(400).json({ success: false, message: '名称和URL为必填' });

    const [result] = await db.execute(
      'INSERT INTO subscriptions (name, url, source, is_active) VALUES (?, ?, ?, 1)',
      [name, url, source || name]
    );

    res.json({ success: true, data: { id: result.insertId } });
  } catch (error) {
    res.status(500).json({ success: false, message: '添加订阅源失败' });
  }
});

router.put('/subscriptions/:id', async (req, res) => {
  try {
    const { name, url, source, is_active } = req.body;
    await db.execute(
      'UPDATE subscriptions SET name = COALESCE(?, name), url = COALESCE(?, url), source = COALESCE(?, source), is_active = COALESCE(?, is_active) WHERE id = ?',
      [name, url, source, is_active, req.params.id]
    );
    res.json({ success: true, message: '更新成功' });
  } catch (error) {
    res.status(500).json({ success: false, message: '更新失败' });
  }
});

router.delete('/subscriptions/:id', async (req, res) => {
  try {
    await db.execute('DELETE FROM subscriptions WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: '删除成功' });
  } catch (error) {
    res.status(500).json({ success: false, message: '删除失败' });
  }
});

// ============ 节点管理 ============
router.get('/nodes', async (req, res) => {
  try {
    const nodes = await db.query('SELECT * FROM nodes ORDER BY sort_order ASC, id ASC');
    res.json({ success: true, data: nodes });
  } catch (error) {
    res.status(500).json({ success: false, message: '获取节点失败' });
  }
});

router.post('/nodes', async (req, res) => {
  try {
    const { name, type, server, port, country, country_code, flag, node_group, ...rest } = req.body;
    if (!name || !server || !port || !country || !country_code || !flag || !node_group) {
      return res.status(400).json({ success: false, message: '缺少必要字段' });
    }

    const fields = ['name', 'type', 'server', 'port', 'country', 'country_code', 'flag', 'node_group'];
    const values = [name, type, server, port, country, country_code, flag, node_group];
    const placeholders = fields.map(() => '?').join(',');

    // 动态添加可选字段
    const optionalFields = ['uuid', 'password', 'cipher', 'network', 'tls', 'sni', 'path', 'host', 'flow', 'encryption', 'alpn', 'auth', 'alter_id'];
    for (const field of optionalFields) {
      if (rest[field] !== undefined) {
        fields.push(field);
        values.push(rest[field]);
        placeholders += ',?';
      }
    }

    const [result] = await db.execute(
      `INSERT INTO nodes (${fields.join(',')}) VALUES (${placeholders})`,
      values
    );

    res.json({ success: true, data: { id: result.insertId } });
  } catch (error) {
    res.status(500).json({ success: false, message: '添加节点失败' });
  }
});

router.put('/nodes/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updates = [];
    const values = [];

    for (const [key, value] of Object.entries(req.body)) {
      if (value !== undefined) {
        updates.push(`${key} = ?`);
        values.push(value);
      }
    }

    if (updates.length === 0) {
      return res.status(400).json({ success: false, message: '没有需要更新的字段' });
    }

    values.push(id);
    await db.execute(`UPDATE nodes SET ${updates.join(', ')} WHERE id = ?`, values);
    res.json({ success: true, message: '更新成功' });
  } catch (error) {
    res.status(500).json({ success: false, message: '更新失败' });
  }
});

router.delete('/nodes/:id', async (req, res) => {
  try {
    await db.execute('DELETE FROM nodes WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: '删除成功' });
  } catch (error) {
    res.status(500).json({ success: false, message: '删除失败' });
  }
});

// ============ 套餐管理 ============
router.get('/plans', async (req, res) => {
  try {
    const plans = await db.query('SELECT * FROM plans ORDER BY sort_order ASC');
    for (const plan of plans) {
      const features = await db.query('SELECT feature FROM plan_features WHERE plan_id = ? ORDER BY sort_order', [plan.id]);
      plan.features = features.map(f => f.feature);
      const groups = await db.query('SELECT node_group FROM plan_node_groups WHERE plan_id = ?', [plan.id]);
      plan.nodeGroups = groups.map(g => g.node_group);
    }
    res.json({ success: true, data: plans });
  } catch (error) {
    res.status(500).json({ success: false, message: '获取套餐失败' });
  }
});

router.post('/plans', async (req, res) => {
  try {
    const { name, price, duration_days, data_limit_gb, speed_limit_mbps, is_popular, features, nodeGroups } = req.body;
    if (!name || !price) return res.status(400).json({ success: false, message: '名称和价格为必填' });

    const [result] = await db.execute(
      'INSERT INTO plans (name, price, duration_days, data_limit_gb, speed_limit_mbps, is_popular) VALUES (?, ?, ?, ?, ?, ?)',
      [name, price, duration_days || 30, data_limit_gb || 100, speed_limit_mbps || null, is_popular ? 1 : 0]
    );

    const planId = result.insertId;

    // 插入特性
    if (features && features.length > 0) {
      for (let i = 0; i < features.length; i++) {
        await db.execute('INSERT INTO plan_features (plan_id, feature, sort_order) VALUES (?, ?, ?)', [planId, features[i], i]);
      }
    }

    // 插入节点组
    if (nodeGroups && nodeGroups.length > 0) {
      for (const group of nodeGroups) {
        await db.execute('INSERT INTO plan_node_groups (plan_id, node_group) VALUES (?, ?)', [planId, group]);
      }
    }

    res.json({ success: true, data: { id: planId } });
  } catch (error) {
    res.status(500).json({ success: false, message: '添加套餐失败' });
  }
});

router.put('/plans/:id', async (req, res) => {
  try {
    const { name, price, duration_days, data_limit_gb, speed_limit_mbps, is_popular, is_active, features, nodeGroups } = req.body;
    await db.execute(
      'UPDATE plans SET name = COALESCE(?, name), price = COALESCE(?, price), duration_days = COALESCE(?, duration_days), data_limit_gb = COALESCE(?, data_limit_gb), speed_limit_mbps = COALESCE(?, speed_limit_mbps), is_popular = COALESCE(?, is_popular), is_active = COALESCE(?, is_active) WHERE id = ?',
      [name, price, duration_days, data_limit_gb, speed_limit_mbps, is_popular !== undefined ? (is_popular ? 1 : 0) : null, is_active !== undefined ? (is_active ? 1 : 0) : null, req.params.id]
    );

    // 更新特性
    if (features) {
      await db.execute('DELETE FROM plan_features WHERE plan_id = ?', [req.params.id]);
      for (let i = 0; i < features.length; i++) {
        await db.execute('INSERT INTO plan_features (plan_id, feature, sort_order) VALUES (?, ?, ?)', [req.params.id, features[i], i]);
      }
    }

    // 更新节点组
    if (nodeGroups) {
      await db.execute('DELETE FROM plan_node_groups WHERE plan_id = ?', [req.params.id]);
      for (const group of nodeGroups) {
        await db.execute('INSERT INTO plan_node_groups (plan_id, node_group) VALUES (?, ?)', [req.params.id, group]);
      }
    }

    res.json({ success: true, message: '更新成功' });
  } catch (error) {
    res.status(500).json({ success: false, message: '更新失败' });
  }
});

router.delete('/plans/:id', async (req, res) => {
  try {
    await db.execute('DELETE FROM plans WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: '删除成功' });
  } catch (error) {
    res.status(500).json({ success: false, message: '删除失败' });
  }
});

// ============ 节点分配 ============
router.post('/plan-nodes/assign', async (req, res) => {
  try {
    const { planId, nodeIds } = req.body;
    if (!planId || !nodeIds || nodeIds.length === 0) {
      return res.status(400).json({ success: false, message: '请选择套餐和节点' });
    }

    await db.transaction(async (conn) => {
      await conn.execute('DELETE FROM plan_nodes WHERE plan_id = ?', [planId]);
      for (let i = 0; i < nodeIds.length; i++) {
        await conn.execute('INSERT INTO plan_nodes (plan_id, node_id, priority) VALUES (?, ?, ?)', [planId, nodeIds[i], i + 1]);
      }
    });

    res.json({ success: true, message: '节点分配成功' });
  } catch (error) {
    res.status(500).json({ success: false, message: '分配失败' });
  }
});

router.put('/plan-nodes/:planId/:nodeId', async (req, res) => {
  try {
    const { customName, priority } = req.body;
    const updates = [];
    const values = [];
    if (customName !== undefined) { updates.push('custom_name = ?'); values.push(customName); }
    if (priority !== undefined) { updates.push('priority = ?'); values.push(priority); }
    values.push(req.params.planId, req.params.nodeId);

    await db.execute(`UPDATE plan_nodes SET ${updates.join(', ')} WHERE plan_id = ? AND node_id = ?`, values);
    res.json({ success: true, message: '更新成功' });
  } catch (error) {
    res.status(500).json({ success: false, message: '更新失败' });
  }
});

// ============ 用户管理 ============
router.get('/users', async (req, res) => {
  try {
    const users = await db.query(`
      SELECT u.id, u.username, u.email, u.email_verified, u.balance, u.plan_id, u.plan_expire_at, 
             u.data_used, u.status, u.created_at, u.last_login_at,
             p.name as plan_name
      FROM users u 
      LEFT JOIN plans p ON u.plan_id = p.id 
      ORDER BY u.created_at DESC
    `);
    res.json({ success: true, data: users });
  } catch (error) {
    res.status(500).json({ success: false, message: '获取用户列表失败' });
  }
});

router.put('/users/:id', async (req, res) => {
  try {
    const { status, balance, plan_id, plan_expire_at } = req.body;
    const updates = [];
    const values = [];

    if (status !== undefined) { updates.push('status = ?'); values.push(status); }
    if (balance !== undefined) { updates.push('balance = ?'); values.push(balance); }
    if (plan_id !== undefined) { updates.push('plan_id = ?'); values.push(plan_id || null); }
    if (plan_expire_at !== undefined) { updates.push('plan_expire_at = ?'); values.push(plan_expire_at || null); }

    if (updates.length === 0) {
      return res.status(400).json({ success: false, message: '没有需要更新的字段' });
    }

    values.push(req.params.id);
    await db.execute(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, values);
    res.json({ success: true, message: '更新成功' });
  } catch (error) {
    res.status(500).json({ success: false, message: '更新失败' });
  }
});

router.delete('/users/:id', async (req, res) => {
  try {
    await db.execute('DELETE FROM users WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: '删除成功' });
  } catch (error) {
    res.status(500).json({ success: false, message: '删除失败' });
  }
});

// ============ 订单管理 ============
router.get('/orders', async (req, res) => {
  try {
    const { page = 1, limit = 20, status } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let sql = `SELECT o.*, u.username, p.name as plan_name FROM orders o 
               LEFT JOIN users u ON o.user_id = u.id 
               LEFT JOIN plans p ON o.plan_id = p.id`;
    const params = [];

    if (status) {
      sql += ' WHERE o.status = ?';
      params.push(status);
    }

    sql += ' ORDER BY o.created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), offset);

    const orders = await db.query(sql, params);

    const [countResult] = await db.query('SELECT COUNT(*) AS total FROM orders');
    const total = countResult[0].total;

    res.json({ success: true, data: orders, pagination: { page: parseInt(page), limit: parseInt(limit), total } });
  } catch (error) {
    res.status(500).json({ success: false, message: '获取订单失败' });
  }
});

router.put('/orders/:id', async (req, res) => {
  try {
    const { status, notes } = req.body;
    const updates = [];
    const values = [];

    if (status !== undefined) { updates.push('status = ?'); values.push(status); }
    if (notes !== undefined) { updates.push('notes = ?'); values.push(notes); }

    if (updates.length === 0) {
      return res.status(400).json({ success: false, message: '没有需要更新的字段' });
    }

    values.push(req.params.id);
    await db.execute(`UPDATE orders SET ${updates.join(', ')} WHERE id = ?`, values);
    res.json({ success: true, message: '更新成功' });
  } catch (error) {
    res.status(500).json({ success: false, message: '更新失败' });
  }
});

// ============ 系统配置 ============
router.get('/config', async (req, res) => {
  try {
    const configs = await db.query('SELECT config_key, config_value FROM system_configs');
    const configMap = {};
    for (const c of configs) {
      configMap[c.config_key] = c.config_value;
    }
    res.json({ success: true, data: configMap });
  } catch (error) {
    res.status(500).json({ success: false, message: '获取配置失败' });
  }
});

router.put('/config', async (req, res) => {
  try {
    const updates = req.body;
    for (const [key, value] of Object.entries(updates)) {
      await db.execute(
        'INSERT INTO system_configs (config_key, config_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE config_value = ?',
        [key, String(value), String(value)]
      );
    }
    res.json({ success: true, message: '配置更新成功' });
  } catch (error) {
    res.status(500).json({ success: false, message: '更新配置失败' });
  }
});

module.exports = router;
