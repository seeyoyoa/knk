/**
 * 认证路由 - 用户注册、登录、密码重置
 */
const express = require('express');
const bcrypt = require('bcrypt');
const { body, validationResult } = require('express-validator');
const db = require('../config/database');
const { generateToken } = require('../middleware/auth');
const crypto = require('crypto');

const router = express.Router();

// ============ 用户注册 ============
router.post('/register', [
  body('username').trim().isLength({ min: 2, max: 50 }).withMessage('用户名需要2-50个字符'),
  body('email').isEmail().normalizeEmail().withMessage('请输入有效的邮箱地址'),
  body('password').isLength({ min: 6, max: 100 }).withMessage('密码需要6-100个字符'),
  body('verificationCode').optional().trim().isLength({ min: 4, max: 10 }).withMessage('验证码格式不正确'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, message: '数据验证失败', errors: errors.array() });
    }

    const { username, email, password, verificationCode } = req.body;

    // 检查用户名是否已存在
    const existingUsers = await db.query('SELECT id FROM users WHERE username = ? OR email = ?', [username, email]);
    if (existingUsers.length > 0) {
      return res.status(400).json({ success: false, message: '用户名或邮箱已存在' });
    }

    // 检查邮箱验证（如果启用）
    const configs = await db.query("SELECT config_value FROM system_configs WHERE config_key = 'email_enabled'");
    const emailEnabled = configs.length > 0 && configs[0].config_value === '1';

    if (emailEnabled && verificationCode) {
      const now = new Date();
      const codes = await db.query(
        'SELECT * FROM email_verification_codes WHERE email = ? AND code = ? AND purpose = ? AND is_used = 0 AND expires_at > ? ORDER BY created_at DESC LIMIT 1',
        [email, verificationCode, 'register', now]
      );

      if (codes.length === 0) {
        return res.status(400).json({ success: false, message: '验证码无效或已过期' });
      }

      // 标记验证码为已使用
      await db.execute('UPDATE email_verification_codes SET is_used = 1, used_at = NOW() WHERE id = ?', [codes[0].id]);
    } else if (emailEnabled && !verificationCode) {
      return res.status(400).json({ success: false, message: '需要提供邮箱验证码' });
    }

    // 密码加密
    const saltRounds = parseInt(process.env.BCRYPT_ROUNDS || '10');
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // 生成订阅令牌
    const subscriptionToken = crypto.randomBytes(32).toString('hex');

    // 插入用户
    const [result] = await db.execute(
      'INSERT INTO users (username, email, email_verified, password_hash, subscription_token, status) VALUES (?, ?, ?, ?, ?, ?)',
      [username, email, emailEnabled ? 1 : 0, passwordHash, subscriptionToken, 'active']
    );

    // 生成 JWT 令牌
    const token = generateToken({ id: result.insertId, type: 'user', username, email });

    res.status(201).json({
      success: true,
      message: '注册成功',
      data: {
        token,
        user: {
          id: result.insertId,
          username,
          email,
          email_verified: emailEnabled ? 1 : 0,
          subscription_token: subscriptionToken,
          status: 'active',
        },
      },
    });
  } catch (error) {
    req.logger?.error('注册失败:', error);
    res.status(500).json({ success: false, message: '注册失败，请稍后重试' });
  }
});

// ============ 用户登录 ============
router.post('/login', [
  body('username').trim().notEmpty().withMessage('请输入用户名'),
  body('password').notEmpty().withMessage('请输入密码'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, message: '数据验证失败', errors: errors.array() });
    }

    const { username, password } = req.body;

    // 查找用户
    const users = await db.query(
      'SELECT id, username, email, email_verified, password_hash, balance, plan_id, plan_expire_at, data_used, subscription_token, status FROM users WHERE username = ? OR email = ?',
      [username, username]
    );

    if (users.length === 0) {
      return res.status(401).json({ success: false, message: '用户名或密码错误' });
    }

    const user = users[0];

    // 验证密码
    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    if (!isValidPassword) {
      return res.status(401).json({ success: false, message: '用户名或密码错误' });
    }

    // 检查账户状态
    if (user.status === 'suspended') {
      return res.status(403).json({ success: false, message: '账户已被暂停，请联系客服' });
    }

    // 更新最后登录时间
    await db.execute('UPDATE users SET last_login_at = NOW(), last_login_ip = ? WHERE id = ?', [req.ip, user.id]);

    // 生成 JWT 令牌
    const token = generateToken({ id: user.id, type: 'user', username: user.username, email: user.email });

    res.json({
      success: true,
      message: '登录成功',
      data: {
        token,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          email_verified: user.email_verified,
          balance: user.balance,
          plan_id: user.plan_id,
          plan_expire_at: user.plan_expire_at,
          data_used: user.data_used,
          subscription_token: user.subscription_token,
          status: user.status,
        },
      },
    });
  } catch (error) {
    req.logger?.error('登录失败:', error);
    res.status(500).json({ success: false, message: '登录失败，请稍后重试' });
  }
});

// ============ 管理员登录 ============
router.post('/admin/login', [
  body('username').trim().notEmpty().withMessage('请输入用户名'),
  body('password').notEmpty().withMessage('请输入密码'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, message: '数据验证失败', errors: errors.array() });
    }

    const { username, password } = req.body;

    // 查找管理员
    const admins = await db.query('SELECT * FROM admins WHERE username = ? AND is_active = 1', [username]);
    if (admins.length === 0) {
      return res.status(401).json({ success: false, message: '用户名或密码错误' });
    }

    const admin = admins[0];

    // 验证密码（兼容明文和哈希）
    let isValidPassword = false;
    if (admin.password_hash.startsWith('$2b$') || admin.password_hash.startsWith('$2a$')) {
      isValidPassword = await bcrypt.compare(password, admin.password_hash);
    } else {
      // 兼容旧版明文密码（首次登录后自动升级）
      if (admin.password_hash === password) {
        isValidPassword = true;
        // 升级为哈希密码
        const saltRounds = parseInt(process.env.BCRYPT_ROUNDS || '10');
        const hash = await bcrypt.hash(password, saltRounds);
        await db.execute('UPDATE admins SET password_hash = ? WHERE id = ?', [hash, admin.id]);
      }
    }

    if (!isValidPassword) {
      return res.status(401).json({ success: false, message: '用户名或密码错误' });
    }

    // 更新最后登录时间
    await db.execute('UPDATE admins SET last_login_at = NOW(), last_login_ip = ? WHERE id = ?', [req.ip, admin.id]);

    // 生成 JWT 令牌
    const token = generateToken({ id: admin.id, type: 'admin', username: admin.username, role: admin.role });

    res.json({
      success: true,
      message: '登录成功',
      data: {
        token,
        admin: {
          id: admin.id,
          username: admin.username,
          role: admin.role,
        },
      },
    });
  } catch (error) {
    req.logger?.error('管理员登录失败:', error);
    res.status(500).json({ success: false, message: '登录失败，请稍后重试' });
  }
});

// ============ 获取当前用户信息 ============
router.get('/me', async (req, res) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;
    if (!token) return res.status(401).json({ success: false, message: '未登录' });

    const { verifyToken } = require('../middleware/auth');
    const decoded = verifyToken(token);

    if (decoded.type === 'user') {
      const users = await db.query(
        'SELECT id, username, email, email_verified, balance, plan_id, plan_expire_at, data_used, subscription_token, status, created_at FROM users WHERE id = ?',
        [decoded.id]
      );
      if (users.length === 0) return res.status(401).json({ success: false, message: '用户不存在' });
      return res.json({ success: true, data: { user: users[0], type: 'user' } });
    } else if (decoded.type === 'admin') {
      const admins = await db.query('SELECT id, username, role FROM admins WHERE id = ?', [decoded.id]);
      if (admins.length === 0) return res.status(401).json({ success: false, message: '管理员不存在' });
      return res.json({ success: true, data: { admin: admins[0], type: 'admin' } });
    }

    res.status(401).json({ success: false, message: '无效的令牌' });
  } catch (error) {
    res.status(401).json({ success: false, message: '令牌无效或已过期' });
  }
});

module.exports = router;
