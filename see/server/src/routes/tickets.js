const express = require('express');
const { body, query, validationResult } = require('express-validator');
const { authenticate, requireAdmin } = require('../middleware/auth');
const pool = require('../config/database');

const router = express.Router();

// ============================================
// 用户端工单接口
// ============================================

// 创建工单
router.post('/create', authenticate, [
  body('subject').trim().isLength({ min: 2, max: 200 }).withMessage('标题长度2-200字符'),
  body('category').isIn(['technical', 'payment', 'account', 'refund', 'other']).withMessage('请选择正确的类别'),
  body('priority').optional().isIn(['low', 'medium', 'high', 'urgent']),
  body('content').trim().isLength({ min: 5, max: 5000 }).withMessage('内容长度5-5000字符'),
  body('planId').optional().isInt(),
  body('orderId').optional().isInt(),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

    const { subject, category, priority = 'medium', content, planId, orderId } = req.body;
    const userId = req.user.id;
    const ticketNo = `TK-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substr(2, 4).toUpperCase()}`;

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      // 获取用户信息
      const [users] = await conn.query('SELECT username, email FROM users WHERE id = ?', [userId]);
      if (users.length === 0) return res.status(404).json({ success: false, message: '用户不存在' });

      const { username, email } = users[0];

      // 获取套餐信息
      let planName = null;
      if (planId) {
        const [plans] = await conn.query('SELECT name FROM plans WHERE id = ?', [planId]);
        if (plans.length > 0) planName = plans[0].name;
      }

      // 创建工单
      const [result] = await conn.query(
        `INSERT INTO tickets (ticket_no, user_id, username, user_email, subject, category, priority, content, plan_id, plan_name, order_id, last_reply_at, unread_count, message_count)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), 0, 0)`,
        [ticketNo, userId, username, email, subject, category, priority, content, planId || null, planName, orderId || null]
      );

      const ticketId = result.insertId;

      // 创建第一条消息
      await conn.query(
        `INSERT INTO ticket_messages (ticket_id, sender_id, sender_type, sender_name, content, is_read)
         VALUES (?, ?, 'user', ?, ?, FALSE)`,
        [ticketId, userId, username, content]
      );

      await conn.commit();
      res.json({ success: true, message: '工单创建成功', data: { ticketId, ticketNo } });
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  } catch (err) {
    console.error('创建工单失败:', err);
    res.status(500).json({ success: false, message: '服务器错误' });
  }
});

// 获取我的工单列表
router.get('/my', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const status = req.query.status || 'all';
    const offset = (page - 1) * limit;

    let whereClause = 'WHERE t.user_id = ?';
    const params = [userId];

    if (status !== 'all') {
      whereClause += ' AND t.status = ?';
      params.push(status);
    }

    const [tickets] = await pool.query(
      `SELECT t.*, 
              (SELECT COUNT(*) FROM ticket_messages WHERE ticket_id = t.id AND sender_type != 'user' AND is_read = FALSE) as admin_unread
       FROM tickets t ${whereClause}
       ORDER BY t.last_reply_at DESC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    const [total] = await pool.query(
      `SELECT COUNT(*) as total FROM tickets t ${whereClause}`,
      params
    );

    res.json({ success: true, data: { tickets, total: total[0].total, page, limit } });
  } catch (err) {
    console.error('获取工单列表失败:', err);
    res.status(500).json({ success: false, message: '服务器错误' });
  }
});

// 获取工单详情（含消息）
router.get('/detail/:ticketId', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const ticketId = parseInt(req.params.ticketId);

    const [tickets] = await pool.query(
      `SELECT * FROM tickets WHERE id = ? AND user_id = ?`,
      [ticketId, userId]
    );

    if (tickets.length === 0) return res.status(404).json({ success: false, message: '工单不存在' });

    const [messages] = await pool.query(
      `SELECT * FROM ticket_messages WHERE ticket_id = ? ORDER BY created_at ASC`,
      [ticketId]
    );

    // 标记管理员消息为已读
    await pool.query(
      `UPDATE ticket_messages SET is_read = TRUE WHERE ticket_id = ? AND sender_type != 'user' AND is_read = FALSE`,
      [ticketId]
    );

    res.json({ success: true, data: { ticket: tickets[0], messages } });
  } catch (err) {
    console.error('获取工单详情失败:', err);
    res.status(500).json({ success: false, message: '服务器错误' });
  }
});

// 回复工单
router.post('/reply/:ticketId', authenticate, [
  body('content').trim().isLength({ min: 1, max: 5000 }).withMessage('回复内容不能为空'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

    const userId = req.user.id;
    const ticketId = parseInt(req.params.ticketId);
    const { content } = req.body;

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      // 检查工单
      const [tickets] = await conn.query('SELECT * FROM tickets WHERE id = ? AND user_id = ?', [ticketId, userId]);
      if (tickets.length === 0) return res.status(404).json({ success: false, message: '工单不存在' });

      const ticket = tickets[0];
      if (ticket.status === 'closed') return res.status(400).json({ success: false, message: '工单已关闭' });

      // 添加消息
      await conn.query(
        `INSERT INTO ticket_messages (ticket_id, sender_id, sender_type, sender_name, content, is_read)
         VALUES (?, ?, 'user', ?, ?, FALSE)`,
        [ticketId, userId, ticket.username, content]
      );

      // 更新工单
      const newStatus = ticket.status === 'resolved' ? 'pending' : ticket.status;
      await conn.query(
        `UPDATE tickets SET status = ?, last_reply_at = NOW(), message_count = message_count + 1, unread_count = unread_count + 1 WHERE id = ?`,
        [newStatus, ticketId]
      );

      await conn.commit();
      res.json({ success: true, message: '回复成功' });
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  } catch (err) {
    console.error('回复工单失败:', err);
    res.status(500).json({ success: false, message: '服务器错误' });
  }
});

// ============================================
// 管理端工单接口
// ============================================

// 获取所有工单（管理员）
router.get('/admin/list', requireAdmin, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const status = req.query.status || 'all';
    const category = req.query.category || 'all';
    const priority = req.query.priority || 'all';
    const assignedTo = req.query.assignedTo || 'all';
    const search = req.query.search || '';
    const offset = (page - 1) * limit;

    let whereClause = 'WHERE 1=1';
    const params = [];

    if (status !== 'all') { whereClause += ' AND t.status = ?'; params.push(status); }
    if (category !== 'all') { whereClause += ' AND t.category = ?'; params.push(category); }
    if (priority !== 'all') { whereClause += ' AND t.priority = ?'; params.push(priority); }
    if (assignedTo !== 'all') {
      if (assignedTo === 'unassigned') { whereClause += ' AND t.assigned_admin_id IS NULL'; }
      else { whereClause += ' AND t.assigned_admin_id = ?'; params.push(assignedTo); }
    }
    if (search) {
      whereClause += ' AND (t.ticket_no LIKE ? OR t.subject LIKE ? OR t.username LIKE ? OR t.user_email LIKE ?)';
      params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
    }

    const [tickets] = await pool.query(
      `SELECT t.*, 
              (SELECT content FROM ticket_messages WHERE ticket_id = t.id ORDER BY created_at DESC LIMIT 1) as last_message
       FROM tickets t ${whereClause}
       ORDER BY 
         CASE t.priority WHEN 'urgent' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 WHEN 'low' THEN 4 END,
         t.last_reply_at DESC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    const [total] = await pool.query(`SELECT COUNT(*) as total FROM tickets t ${whereClause}`, params);

    // 统计数据
    const [statsRows] = await pool.query(
      `SELECT 
         COUNT(*) as total,
         SUM(CASE WHEN status = 'open' THEN 1 ELSE 0 END) as open_count,
         SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending_count,
         SUM(CASE WHEN status = 'resolved' THEN 1 ELSE 0 END) as resolved_count,
         SUM(CASE WHEN status = 'closed' THEN 1 ELSE 0 END) as closed_count,
         SUM(CASE WHEN assigned_admin_id IS NULL AND status != 'closed' THEN 1 ELSE 0 END) as unassigned_count,
         SUM(CASE WHEN unread_count > 0 THEN 1 ELSE 0 END) as unread_count
       FROM tickets`
    );

    res.json({ 
      success: true, 
      data: { 
        tickets, 
        total: total[0].total, 
        page, 
        limit,
        stats: statsRows[0]
      } 
    });
  } catch (err) {
    console.error('获取工单列表失败:', err);
    res.status(500).json({ success: false, message: '服务器错误' });
  }
});

// 获取工单详情（管理员）
router.get('/admin/detail/:ticketId', requireAdmin, async (req, res) => {
  try {
    const ticketId = parseInt(req.params.ticketId);

    const [tickets] = await pool.query('SELECT * FROM tickets WHERE id = ?', [ticketId]);
    if (tickets.length === 0) return res.status(404).json({ success: false, message: '工单不存在' });

    const [messages] = await pool.query(
      `SELECT * FROM ticket_messages WHERE ticket_id = ? ORDER BY created_at ASC`,
      [ticketId]
    );

    // 标记用户消息为已读
    await pool.query(
      `UPDATE ticket_messages SET is_read = TRUE WHERE ticket_id = ? AND sender_type = 'user' AND is_read = FALSE`,
      [ticketId]
    );
    await pool.query(`UPDATE tickets SET unread_count = 0 WHERE id = ?`, [ticketId]);

    res.json({ success: true, data: { ticket: tickets[0], messages } });
  } catch (err) {
    console.error('获取工单详情失败:', err);
    res.status(500).json({ success: false, message: '服务器错误' });
  }
});

// 管理员回复工单
router.post('/admin/reply/:ticketId', requireAdmin, [
  body('content').trim().isLength({ min: 1, max: 5000 }).withMessage('回复内容不能为空'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

    const ticketId = parseInt(req.params.ticketId);
    const { content } = req.body;
    const adminId = req.admin.id;
    const adminName = req.admin.username;

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      const [tickets] = await conn.query('SELECT * FROM tickets WHERE id = ?', [ticketId]);
      if (tickets.length === 0) return res.status(404).json({ success: false, message: '工单不存在' });

      const ticket = tickets[0];

      // 如果未分配，自动分配
      if (!ticket.assigned_admin_id) {
        await conn.query(
          `UPDATE tickets SET assigned_admin_id = ?, assigned_admin_name = ? WHERE id = ?`,
          [adminId, adminName, ticketId]
        );
      }

      // 添加消息
      await conn.query(
        `INSERT INTO ticket_messages (ticket_id, sender_id, sender_type, sender_name, content, is_read)
         VALUES (?, ?, 'admin', ?, ?, FALSE)`,
        [ticketId, adminId, adminName, content]
      );

      // 更新工单
      await conn.query(
        `UPDATE tickets SET status = 'pending', last_reply_at = NOW(), message_count = message_count + 1 WHERE id = ?`,
        [ticketId]
      );

      await conn.commit();
      res.json({ success: true, message: '回复成功' });
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  } catch (err) {
    console.error('回复工单失败:', err);
    res.status(500).json({ success: false, message: '服务器错误' });
  }
});

// 分配工单
router.put('/admin/assign/:ticketId', requireAdmin, [
  body('adminId').isInt().withMessage('请选择管理员'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

    const ticketId = parseInt(req.params.ticketId);
    const { adminId } = req.body;

    const [admins] = await pool.query('SELECT username FROM admins WHERE id = ?', [adminId]);
    if (admins.length === 0) return res.status(404).json({ success: false, message: '管理员不存在' });

    await pool.query(
      `UPDATE tickets SET assigned_admin_id = ?, assigned_admin_name = ?, status = 'pending' WHERE id = ?`,
      [adminId, admins[0].username, ticketId]
    );

    res.json({ success: true, message: '工单已分配' });
  } catch (err) {
    console.error('分配工单失败:', err);
    res.status(500).json({ success: false, message: '服务器错误' });
  }
});

// 更新工单状态
router.put('/admin/status/:ticketId', requireAdmin, [
  body('status').isIn(['open', 'pending', 'resolved', 'closed']).withMessage('状态无效'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

    const ticketId = parseInt(req.params.ticketId);
    const { status, notes } = req.body;
    const adminName = req.admin.username;

    const updates = ['status = ?'];
    const params = [status];

    if (status === 'closed') {
      updates.push('closed_at = NOW()', 'closed_by = ?');
      params.push(adminName);
    }

    if (notes !== undefined) {
      updates.push('admin_notes = ?');
      params.push(notes);
    }

    await pool.query(`UPDATE tickets SET ${updates.join(', ')} WHERE id = ?`, [...params, ticketId]);

    res.json({ success: true, message: '工单状态已更新' });
  } catch (err) {
    console.error('更新工单状态失败:', err);
    res.status(500).json({ success: false, message: '服务器错误' });
  }
});

// 批量操作工单
router.post('/admin/batch', requireAdmin, [
  body('ticketIds').isArray().withMessage('请选择工单'),
  body('action').isIn(['assign', 'status', 'delete']).withMessage('操作无效'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

    const { ticketIds, action, value, adminId } = req.body;

    if (action === 'assign') {
      const [admins] = await pool.query('SELECT username FROM admins WHERE id = ?', [adminId]);
      if (admins.length === 0) return res.status(404).json({ success: false, message: '管理员不存在' });
      
      const placeholders = ticketIds.map(() => '?').join(',');
      await pool.query(
        `UPDATE tickets SET assigned_admin_id = ?, assigned_admin_name = ?, status = 'pending' WHERE id IN (${placeholders})`,
        [adminId, admins[0].username, ...ticketIds]
      );
    } else if (action === 'status') {
      const placeholders = ticketIds.map(() => '?').join(',');
      await pool.query(`UPDATE tickets SET status = ? WHERE id IN (${placeholders})`, [value, ...ticketIds]);
    } else if (action === 'delete') {
      const placeholders = ticketIds.map(() => '?').join(',');
      await pool.query(`DELETE FROM tickets WHERE id IN (${placeholders})`, [...ticketIds]);
    }

    res.json({ success: true, message: '批量操作成功' });
  } catch (err) {
    console.error('批量操作失败:', err);
    res.status(500).json({ success: false, message: '服务器错误' });
  }
});

// 获取快捷回复列表
router.get('/admin/quick-replies', requireAdmin, async (req, res) => {
  try {
    const category = req.query.category || 'all';
    let whereClause = 'WHERE is_public = TRUE';
    const params = [];

    if (category !== 'all') {
      whereClause += ' AND category = ?';
      params.push(category);
    }

    const [replies] = await pool.query(
      `SELECT * FROM quick_replies ${whereClause} ORDER BY usage_count DESC, created_at DESC`,
      params
    );

    res.json({ success: true, data: replies });
  } catch (err) {
    console.error('获取快捷回复失败:', err);
    res.status(500).json({ success: false, message: '服务器错误' });
  }
});

// 创建快捷回复
router.post('/admin/quick-replies', requireAdmin, [
  body('title').trim().isLength({ min: 1, max: 100 }).withMessage('标题长度1-100字符'),
  body('content').trim().isLength({ min: 1, max: 2000 }).withMessage('内容不能为空'),
  body('category').optional().isLength({ max: 50 }),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

    const { title, content, category = 'general', isPublic = true } = req.body;

    await pool.query(
      `INSERT INTO quick_replies (admin_id, title, content, category, is_public) VALUES (?, ?, ?, ?, ?)`,
      [req.admin.id, title, content, category, isPublic]
    );

    res.json({ success: true, message: '快捷回复创建成功' });
  } catch (err) {
    console.error('创建快捷回复失败:', err);
    res.status(500).json({ success: false, message: '服务器错误' });
  }
});

// 删除快捷回复
router.delete('/admin/quick-replies/:id', requireAdmin, async (req, res) => {
  try {
    await pool.query('DELETE FROM quick_replies WHERE id = ? AND (admin_id = ? OR ? = 1)', 
      [req.params.id, req.admin.id, req.admin.role === 'superadmin' ? 1 : 0]);
    res.json({ success: true, message: '快捷回复已删除' });
  } catch (err) {
    console.error('删除快捷回复失败:', err);
    res.status(500).json({ success: false, message: '服务器错误' });
  }
});

module.exports = router;
