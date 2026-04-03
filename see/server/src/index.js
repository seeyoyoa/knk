const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { body, param, validationResult } = require('express-validator');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const { initializeDatabase, query, queryOne } = require('./config/database');
const { generateToken, authUser, authAdmin, optionalAuth } = require('./middleware/auth');
const { sendVerificationEmail } = require('./services/email');

const app = express();
const PORT = process.env.PORT || 3000;

// ============ 中间件 ============
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
}));

app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// 请求日志
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url} ${res.statusCode} ${duration}ms`);
  });
  next();
});

// ============ 速率限制 ============
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  message: { success: false, message: '请求过于频繁，请稍后再试' },
  standardHeaders: true,
  legacyHeaders: false,
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { success: false, message: '操作过于频繁，请稍后再试' },
  skipSuccessfulRequests: true,
});

const emailLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  message: { success: false, message: '发送次数过多，请1小时后再试' },
});

app.use('/api/', globalLimiter);

// ============ 路由注册 ============
const ticketRoutes = require('./routes/tickets');
app.use('/api/tickets', ticketRoutes);

const subscriptionRoutes = require('./routes/subscription');
app.use('/api/subscription', subscriptionRoutes);

// ============ 健康检查 ============
app.get('/api/health', (req, res) => {
  res.json({ success: true, status: 'ok', timestamp: new Date().toISOString() });
});

// ============ 验证错误处理 ============
function handleValidation(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, message: errors.array()[0].msg });
  }
  next();
}

// ============ 工具函数 ============
function generateSubscriptionToken() {
  return crypto.randomBytes(32).toString('hex');
}

function generateOrderNo() {
  const timestamp = Date.now().toString(36);
  const random = crypto.randomBytes(4).toString('hex');
  return `ORD${timestamp}${random}`.toUpperCase();
}

// ============ 认证路由 ============

// 用户注册
app.post('/api/auth/register', authLimiter, [
  body('username').isLength({ min: 2, max: 50 }).withMessage('用户名需要2-50个字符'),
  body('email').isEmail().withMessage('请输入有效的邮箱地址'),
  body('password').isLength({ min: 6 }).withMessage('密码至少需要6个字符'),
  body('verificationCode').optional().isLength({ min: 4, max: 8 }).withMessage('验证码格式错误'),
], handleValidation, async (req, res) => {
  try {
    const { username, email, password, verificationCode } = req.body;

    // 检查用户名/邮箱是否已存在
    const existing = await queryOne('SELECT id FROM users WHERE username = ? OR email = ?', [username, email]);
    if (existing) {
      return res.status(400).json({ success: false, message: '用户名或邮箱已存在' });
    }

    // 如果启用了邮箱验证，验证验证码
    const emailConfigRow = await queryOne("SELECT config_value FROM system_configs WHERE config_key = 'email_config'");
    if (emailConfigRow) {
      const emailConfig = typeof emailConfigRow.config_value === 'string' 
        ? JSON.parse(emailConfigRow.config_value) 
        : emailConfigRow.config_value;
      
      if (emailConfig.isEnabled && verificationCode) {
        const codeRecord = await queryOne(
          'SELECT * FROM email_verification_codes WHERE email = ? AND code = ? AND purpose = "register" AND is_used = FALSE AND expires_at > NOW()',
          [email, verificationCode]
        );
        if (!codeRecord) {
          return res.status(400).json({ success: false, message: '验证码无效或已过期' });
        }
        if (codeRecord.attempts >= codeRecord.max_attempts) {
          return res.status(400).json({ success: false, message: '验证次数已达上限' });
        }
        // 标记验证码已使用
        await query('UPDATE email_verification_codes SET is_used = TRUE, used_at = NOW() WHERE id = ?', [codeRecord.id]);
      }
    }

    // 密码加密
    const passwordHash = await bcrypt.hash(password, 12);
    const subscriptionToken = generateSubscriptionToken();

    // 插入用户
    const [result] = await query(
      'INSERT INTO users (username, email, password_hash, subscription_token) VALUES (?, ?, ?, ?)',
      [username, email, passwordHash, subscriptionToken]
    );

    const token = generateToken({ id: result.insertId, username, type: 'user' });

    res.json({
      success: true,
      message: '注册成功',
      data: {
        user: { id: result.insertId, username, email, subscriptionToken },
        token,
      },
    });
  } catch (error) {
    console.error('[Register Error]', error);
    res.status(500).json({ success: false, message: '注册失败，请稍后重试' });
  }
});

// 用户登录
app.post('/api/auth/login', authLimiter, [
  body('username').notEmpty().withMessage('请输入用户名'),
  body('password').notEmpty().withMessage('请输入密码'),
], handleValidation, async (req, res) => {
  try {
    const { username, password } = req.body;

    const user = await queryOne(
      'SELECT id, username, email, password_hash, balance, plan_id, plan_expire, data_used, subscription_token, status FROM users WHERE username = ? OR email = ?',
      [username, username]
    );

    if (!user) {
      return res.status(401).json({ success: false, message: '用户名或密码错误' });
    }

    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      return res.status(401).json({ success: false, message: '用户名或密码错误' });
    }

    // 更新最后登录时间
    await query('UPDATE users SET last_login = NOW() WHERE id = ?', [user.id]);

    const token = generateToken({ id: user.id, username: user.username, type: 'user' });

    res.json({
      success: true,
      message: '登录成功',
      data: {
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          balance: user.balance,
          planId: user.plan_id,
          planExpire: user.plan_expire,
          dataUsed: user.data_used,
          subscriptionToken: user.subscription_token,
          status: user.status,
        },
        token,
      },
    });
  } catch (error) {
    console.error('[Login Error]', error);
    res.status(500).json({ success: false, message: '登录失败，请稍后重试' });
  }
});

// 管理员登录
app.post('/api/auth/admin-login', authLimiter, [
  body('username').notEmpty().withMessage('请输入用户名'),
  body('password').notEmpty().withMessage('请输入密码'),
], handleValidation, async (req, res) => {
  try {
    const { username, password } = req.body;

    const admin = await queryOne('SELECT id, username, password_hash, role FROM admins WHERE username = ?', [username]);
    if (!admin) {
      return res.status(401).json({ success: false, message: '用户名或密码错误' });
    }

    const validPassword = await bcrypt.compare(password, admin.password_hash);
    if (!validPassword) {
      return res.status(401).json({ success: false, message: '用户名或密码错误' });
    }

    await query('UPDATE admins SET last_login = NOW() WHERE id = ?', [admin.id]);

    const token = generateToken({ id: admin.id, username: admin.username, type: 'admin' });

    res.json({
      success: true,
      message: '登录成功',
      data: {
        admin: { id: admin.id, username: admin.username, role: admin.role },
        token,
      },
    });
  } catch (error) {
    console.error('[Admin Login Error]', error);
    res.status(500).json({ success: false, message: '登录失败' });
  }
});

// 获取当前用户信息
app.get('/api/auth/me', authUser, async (req, res) => {
  try {
    const user = await queryOne(
      `SELECT u.id, u.username, u.email, u.balance, u.plan_expire, u.data_used, u.subscription_token, u.status,
              p.id as plan_id, p.name as plan_name, p.price as plan_price, p.data_limit_gb, p.speed_limit_mbps, p.duration_days
       FROM users u
       LEFT JOIN plans p ON u.plan_id = p.id
       WHERE u.id = ?`,
      [req.user.id]
    );

    res.json({ success: true, data: user });
  } catch (error) {
    console.error('[Get User Error]', error);
    res.status(500).json({ success: false, message: '获取用户信息失败' });
  }
});

// ============ 用户路由 ============

// 获取用户节点列表
app.get('/api/user/nodes', authUser, async (req, res) => {
  try {
    const nodes = await query(
      `SELECT n.*, pn.custom_name, pn.priority
       FROM nodes n
       INNER JOIN plan_nodes pn ON n.id = pn.node_id
       WHERE pn.plan_id = (SELECT plan_id FROM users WHERE id = ?)
         AND n.is_active = TRUE
       ORDER BY pn.priority ASC`,
      [req.user.id]
    );

    res.json({ success: true, data: nodes });
  } catch (error) {
    console.error('[Get Nodes Error]', error);
    res.status(500).json({ success: false, message: '获取节点失败' });
  }
});

// 获取用户订单
app.get('/api/user/orders', authUser, async (req, res) => {
  try {
    const orders = await query(
      `SELECT o.*, p.name as plan_name
       FROM orders o
       LEFT JOIN plans p ON o.plan_id = p.id
       WHERE o.user_id = ?
       ORDER BY o.created_at DESC`,
      [req.user.id]
    );

    res.json({ success: true, data: orders });
  } catch (error) {
    console.error('[Get Orders Error]', error);
    res.status(500).json({ success: false, message: '获取订单失败' });
  }
});

// 创建订单
app.post('/api/user/order', authUser, [
  body('planId').isInt({ min: 1 }).withMessage('请选择有效的套餐'),
], handleValidation, async (req, res) => {
  try {
    const { planId } = req.body;

    const plan = await queryOne('SELECT * FROM plans WHERE id = ? AND is_active = TRUE', [planId]);
    if (!plan) {
      return res.status(400).json({ success: false, message: '套餐不存在或已下架' });
    }

    const outTradeNo = generateOrderNo();

    const [result] = await query(
      'INSERT INTO orders (user_id, plan_id, amount, out_trade_no, status) VALUES (?, ?, ?, ?, ?)',
      [req.user.id, planId, plan.price, outTradeNo, 'pending']
    );

    res.json({
      success: true,
      message: '订单创建成功',
      data: {
        orderId: result.insertId,
        outTradeNo,
        amount: plan.price,
        planName: plan.name,
      },
    });
  } catch (error) {
    console.error('[Create Order Error]', error);
    res.status(500).json({ success: false, message: '创建订单失败' });
  }
});

// ============ 支付路由 ============

// 支付宝当面付 - 创建订单
app.post('/api/payment/alipay/create', authUser, [
  body('orderId').isInt({ min: 1 }).withMessage('订单ID无效'),
  body('amount').isFloat({ min: 0.01 }).withMessage('金额无效'),
], handleValidation, async (req, res) => {
  try {
    const { orderId, amount, subject } = req.body;

    // 获取支付宝配置
    const configRow = await queryOne("SELECT config_value FROM system_configs WHERE config_key = 'payment_config'");
    if (!configRow) {
      return res.status(500).json({ success: false, message: '支付配置不存在' });
    }

    const config = typeof configRow.config_value === 'string'
      ? JSON.parse(configRow.config_value)
      : configRow.config_value;

    if (!config.alipay.enabled) {
      return res.status(400).json({ success: false, message: '支付宝支付未启用' });
    }

    // 实际调用支付宝当面付API
    // const AlipaySdk = require('alipay-sdk').default;
    // const alipaySdk = new AlipaySdk({ appId, privateKey, alipayPublicKey });
    // const result = await alipaySdk.exec('alipay.trade.precreate', { ... });

    // 模拟返回
    res.json({
      success: true,
      data: {
        qrCode: `https://qr.alipay.com/bax0${orderId}${Date.now().toString(36)}`,
        outTradeNo: `ALI${orderId}${Date.now().toString(36).toUpperCase()}`,
        amount,
        subject: subject || `RocketStore - 套餐购买`,
      },
    });
  } catch (error) {
    console.error('[Alipay Create Error]', error);
    res.status(500).json({ success: false, message: '创建支付订单失败' });
  }
});

// 支付宝回调
app.post('/api/payment/alipay/notify', express.urlencoded({ extended: true }), async (req, res) => {
  try {
    const { out_trade_no, trade_no, total_amount, trade_status } = req.body;

    if (trade_status === 'TRADE_SUCCESS' || trade_status === 'TRADE_FINISHED') {
      // 调用存储过程开通套餐
      await query('CALL sp_activate_plan((SELECT user_id FROM orders WHERE out_trade_no = ?), (SELECT plan_id FROM orders WHERE out_trade_no = ?), (SELECT id FROM orders WHERE out_trade_no = ?))', [out_trade_no, out_trade_no, out_trade_no]);
    }

    res.send('success');
  } catch (error) {
    console.error('[Alipay Notify Error]', error);
    res.send('fail');
  }
});

// USDT支付 - 创建订单
app.post('/api/payment/usdt/create', authUser, [
  body('orderId').isInt({ min: 1 }).withMessage('订单ID无效'),
  body('amountUSD').isFloat({ min: 0.01 }).withMessage('金额无效'),
], handleValidation, async (req, res) => {
  try {
    const { orderId, amountUSD } = req.body;

    const configRow = await queryOne("SELECT config_value FROM system_configs WHERE config_key = 'payment_config'");
    if (!configRow) {
      return res.status(500).json({ success: false, message: '支付配置不存在' });
    }

    const config = typeof configRow.config_value === 'string'
      ? JSON.parse(configRow.config_value)
      : configRow.config_value;

    if (!config.usdt.enabled) {
      return res.status(400).json({ success: false, message: 'USDT支付未启用' });
    }

    res.json({
      success: true,
      data: {
        address: config.usdt.walletAddress,
        network: config.usdt.network,
        amount: amountUSD.toFixed(2),
        orderId,
      },
    });
  } catch (error) {
    console.error('[USDT Create Error]', error);
    res.status(500).json({ success: false, message: '创建USDT订单失败' });
  }
});

// USDT Webhook 回调
app.post('/api/payment/usdt/webhook', async (req, res) => {
  try {
    const { txHash, network, amount, to, orderId } = req.body;

    // 验证交易
    // 实际应用中应调用 TronGrid API 或 NOWPayments API 验证交易

    if (orderId) {
      await query('CALL sp_activate_plan((SELECT user_id FROM orders WHERE id = ?), (SELECT plan_id FROM orders WHERE id = ?), ?)', [orderId, orderId, orderId]);
    }

    res.json({ success: true });
  } catch (error) {
    console.error('[USDT Webhook Error]', error);
    res.status(500).json({ success: false, message: '处理失败' });
  }
});

// 获取支付配置
app.get('/api/payment/config', async (req, res) => {
  try {
    const configRow = await queryOne("SELECT config_value FROM system_configs WHERE config_key = 'payment_config'");
    if (!configRow) {
      return res.json({ success: true, data: null });
    }
    const config = typeof configRow.config_value === 'string'
      ? JSON.parse(configRow.config_value)
      : configRow.config_value;
    res.json({ success: true, data: config });
  } catch (error) {
    res.status(500).json({ success: false, message: '获取配置失败' });
  }
});

// 检查支付状态
app.get('/api/payment/check/:orderId', async (req, res) => {
  try {
    const order = await queryOne('SELECT id, status FROM orders WHERE id = ?', [req.params.orderId]);
    if (!order) {
      return res.status(404).json({ success: false, message: '订单不存在' });
    }
    res.json({ success: true, data: { status: order.status } });
  } catch (error) {
    res.status(500).json({ success: false, message: '查询失败' });
  }
});

// ============ 邮件路由 ============

// 发送验证码
app.post('/api/email/send-code', emailLimiter, [
  body('email').isEmail().withMessage('请输入有效的邮箱地址'),
], handleValidation, async (req, res) => {
  try {
    const { email } = req.body;

    // 获取邮件配置
    const configRow = await queryOne("SELECT config_value FROM system_configs WHERE config_key = 'email_config'");
    if (!configRow) {
      return res.status(400).json({ success: false, message: '邮件服务未配置' });
    }

    const emailConfig = typeof configRow.config_value === 'string'
      ? JSON.parse(configRow.config_value)
      : configRow.config_value;

    if (!emailConfig.isEnabled) {
      return res.status(400).json({ success: false, message: '邮件验证功能未启用' });
    }

    // 检查是否有未过期的验证码
    const existingCode = await queryOne(
      'SELECT * FROM email_verification_codes WHERE email = ? AND purpose = "register" AND is_used = FALSE AND expires_at > NOW()',
      [email]
    );
    if (existingCode) {
      return res.status(400).json({ success: false, message: '验证码已发送，请稍后再试' });
    }

    // 生成验证码
    const codeLength = emailConfig.codeLength || 6;
    const code = Math.floor(Math.random() * Math.pow(10, codeLength)).toString().padStart(codeLength, '0');
    const expiryMinutes = emailConfig.codeExpiry || 5;

    await query(
      'INSERT INTO email_verification_codes (email, code, purpose, expires_at, max_attempts) VALUES (?, ?, "register", DATE_ADD(NOW(), INTERVAL ? MINUTE), ?)',
      [email, code, expiryMinutes, emailConfig.maxAttempts || 5]
    );

    // 发送邮件
    await sendVerificationEmail(email, code, emailConfig);

    res.json({ success: true, message: '验证码已发送' });
  } catch (error) {
    console.error('[Send Code Error]', error);
    res.status(500).json({ success: false, message: '发送验证码失败' });
  }
});

// 验证验证码
app.post('/api/email/verify-code', [
  body('email').isEmail().withMessage('请输入有效的邮箱地址'),
  body('code').notEmpty().withMessage('请输入验证码'),
], handleValidation, async (req, res) => {
  try {
    const { email, code } = req.body;

    const codeRecord = await queryOne(
      'SELECT * FROM email_verification_codes WHERE email = ? AND code = ? AND purpose = "register" AND is_used = FALSE AND expires_at > NOW()',
      [email, code]
    );

    if (!codeRecord) {
      return res.status(400).json({ success: false, message: '验证码无效或已过期' });
    }

    if (codeRecord.attempts >= codeRecord.max_attempts) {
      return res.status(400).json({ success: false, message: '验证次数已达上限' });
    }

    // 标记已使用
    await query('UPDATE email_verification_codes SET is_used = TRUE, used_at = NOW() WHERE id = ?', [codeRecord.id]);

    res.json({ success: true, message: '验证成功' });
  } catch (error) {
    res.status(500).json({ success: false, message: '验证失败' });
  }
});

// 测试邮件配置
app.post('/api/email/test', authAdmin, async (req, res) => {
  try {
    const { smtpHost, smtpPort, smtpSecure, smtpUser, smtpPass, fromEmail, fromName, toEmail } = req.body;

    const nodemailer = require('nodemailer');
    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpSecure,
      auth: { user: smtpUser, pass: smtpPass },
    });

    await transporter.verify();
    await transporter.sendMail({
      from: `"${fromName}" <${fromEmail}>`,
      to: toEmail || fromEmail,
      subject: '测试邮件',
      html: '<p>这是一封测试邮件，SMTP配置正确！</p>',
    });

    res.json({ success: true, message: '测试邮件发送成功' });
  } catch (error) {
    res.json({ success: false, message: error.message });
  }
});

// ============ 管理路由 ============

// 仪表盘统计
app.get('/api/admin/dashboard', authAdmin, async (req, res) => {
  try {
    const [totalUsers] = await query('SELECT COUNT(*) as count FROM users');
    const [activeUsers] = await query('SELECT COUNT(*) as count FROM users WHERE status = "active"');
    const [totalRevenue] = await query('SELECT COALESCE(SUM(amount), 0) as total FROM orders WHERE status = "completed"');
    const [totalNodes] = await query('SELECT COUNT(*) as count FROM nodes');
    const [activeNodes] = await query('SELECT COUNT(*) as count FROM nodes WHERE is_active = TRUE');
    const [subCount] = await query('SELECT COUNT(*) as count FROM subscriptions');

    res.json({
      success: true,
      data: {
        totalUsers: totalUsers[0].count,
        activeUsers: activeUsers[0].count,
        totalRevenue: parseFloat(totalRevenue[0].total),
        totalNodes: totalNodes[0].count,
        activeNodes: activeNodes[0].count,
        subscriptionCount: subCount[0].count,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: '获取统计数据失败' });
  }
});

// 获取所有订阅源
app.get('/api/admin/subscriptions', authAdmin, async (req, res) => {
  try {
    const subs = await query('SELECT * FROM subscriptions ORDER BY id ASC');
    res.json({ success: true, data: subs });
  } catch (error) {
    res.status(500).json({ success: false, message: '获取订阅源失败' });
  }
});

// 创建订阅源
app.post('/api/admin/subscriptions', authAdmin, [
  body('name').notEmpty().withMessage('请输入订阅源名称'),
  body('url').isURL().withMessage('请输入有效的URL'),
], handleValidation, async (req, res) => {
  try {
    const { name, url, source } = req.body;
    const [result] = await query(
      'INSERT INTO subscriptions (name, url, source, is_active) VALUES (?, ?, ?, TRUE)',
      [name, url, source || name]
    );
    res.json({ success: true, data: { id: result.insertId } });
  } catch (error) {
    res.status(500).json({ success: false, message: '创建订阅源失败' });
  }
});

// 删除订阅源
app.delete('/api/admin/subscriptions/:id', authAdmin, async (req, res) => {
  try {
    await query('DELETE FROM subscriptions WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: '删除成功' });
  } catch (error) {
    res.status(500).json({ success: false, message: '删除失败' });
  }
});

// 获取所有节点
app.get('/api/admin/nodes', authAdmin, async (req, res) => {
  try {
    const nodes = await query('SELECT * FROM nodes ORDER BY id ASC');
    res.json({ success: true, data: nodes });
  } catch (error) {
    res.status(500).json({ success: false, message: '获取节点失败' });
  }
});

// 更新节点
app.put('/api/admin/nodes/:id', authAdmin, async (req, res) => {
  try {
    const { name, is_active, custom_name, type, server, port } = req.body;
    const updates = [];
    const values = [];
    if (name !== undefined) { updates.push('name = ?'); values.push(name); }
    if (is_active !== undefined) { updates.push('is_active = ?'); values.push(is_active); }
    if (custom_name !== undefined) { updates.push('custom_name = ?'); values.push(custom_name); }
    if (type !== undefined) { updates.push('type = ?'); values.push(type); }
    if (server !== undefined) { updates.push('server = ?'); values.push(server); }
    if (port !== undefined) { updates.push('port = ?'); values.push(port); }
    
    if (updates.length > 0) {
      values.push(req.params.id);
      await query(`UPDATE nodes SET ${updates.join(', ')} WHERE id = ?`, values);
    }
    res.json({ success: true, message: '更新成功' });
  } catch (error) {
    res.status(500).json({ success: false, message: '更新失败' });
  }
});

// 删除节点
app.delete('/api/admin/nodes/:id', authAdmin, async (req, res) => {
  try {
    await query('DELETE FROM nodes WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: '删除成功' });
  } catch (error) {
    res.status(500).json({ success: false, message: '删除失败' });
  }
});

// 批量更新节点
app.post('/api/admin/nodes/batch', authAdmin, async (req, res) => {
  try {
    const { ids, action, value } = req.body;
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ success: false, message: '请选择节点' });
    }

    if (action === 'enable') {
      await query('UPDATE nodes SET is_active = TRUE WHERE id IN (?)', [ids]);
    } else if (action === 'disable') {
      await query('UPDATE nodes SET is_active = FALSE WHERE id IN (?)', [ids]);
    } else if (action === 'rename') {
      for (const id of ids) {
        await query('UPDATE nodes SET custom_name = ? WHERE id = ?', [value, id]);
      }
    } else if (action === 'delete') {
      await query('DELETE FROM nodes WHERE id IN (?)', [ids]);
    }

    res.json({ success: true, message: '批量操作成功' });
  } catch (error) {
    res.status(500).json({ success: false, message: '批量操作失败' });
  }
});

// 获取所有套餐
app.get('/api/admin/plans', authAdmin, async (req, res) => {
  try {
    const plans = await query('SELECT * FROM plans ORDER BY id ASC');
    res.json({ success: true, data: plans });
  } catch (error) {
    res.status(500).json({ success: false, message: '获取套餐失败' });
  }
});

// 创建套餐
app.post('/api/admin/plans', authAdmin, async (req, res) => {
  try {
    const { name, price, duration_days, data_limit_gb, speed_limit_mbps, node_groups, features, is_popular } = req.body;
    const [result] = await query(
      'INSERT INTO plans (name, price, duration_days, data_limit_gb, speed_limit_mbps, node_groups, features, is_popular) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [name, price, duration_days, data_limit_gb, speed_limit_mbps, JSON.stringify(node_groups || []), JSON.stringify(features || []), is_popular || false]
    );
    res.json({ success: true, data: { id: result.insertId } });
  } catch (error) {
    res.status(500).json({ success: false, message: '创建套餐失败' });
  }
});

// 更新套餐
app.put('/api/admin/plans/:id', authAdmin, async (req, res) => {
  try {
    const { name, price, duration_days, data_limit_gb, speed_limit_mbps, node_groups, features, is_popular, is_active } = req.body;
    await query(
      'UPDATE plans SET name=?, price=?, duration_days=?, data_limit_gb=?, speed_limit_mbps=?, node_groups=?, features=?, is_popular=?, is_active=? WHERE id=?',
      [name, price, duration_days, data_limit_gb, speed_limit_mbps, JSON.stringify(node_groups || []), JSON.stringify(features || []), is_popular, is_active, req.params.id]
    );
    res.json({ success: true, message: '更新成功' });
  } catch (error) {
    res.status(500).json({ success: false, message: '更新失败' });
  }
});

// 获取套餐节点
app.get('/api/admin/plans/:planId/nodes', authAdmin, async (req, res) => {
  try {
    const nodes = await query(
      `SELECT n.*, pn.custom_name, pn.priority
       FROM nodes n
       INNER JOIN plan_nodes pn ON n.id = pn.node_id
       WHERE pn.plan_id = ?
       ORDER BY pn.priority ASC`,
      [req.params.planId]
    );
    res.json({ success: true, data: nodes });
  } catch (error) {
    res.status(500).json({ success: false, message: '获取套餐节点失败' });
  }
});

// 分配节点到套餐
app.post('/api/admin/plans/:planId/nodes', authAdmin, async (req, res) => {
  try {
    const { nodeIds } = req.body;
    if (!nodeIds || !Array.isArray(nodeIds)) {
      return res.status(400).json({ success: false, message: '请选择节点' });
    }

    await query('DELETE FROM plan_nodes WHERE plan_id = ?', [req.params.planId]);

    for (let i = 0; i < nodeIds.length; i++) {
      await query(
        'INSERT INTO plan_nodes (plan_id, node_id, priority) VALUES (?, ?, ?)',
        [req.params.planId, nodeIds[i], i + 1]
      );
    }

    res.json({ success: true, message: '节点分配成功' });
  } catch (error) {
    res.status(500).json({ success: false, message: '分配节点失败' });
  }
});

// 获取所有用户
app.get('/api/admin/users', authAdmin, async (req, res) => {
  try {
    const users = await query(
      `SELECT u.id, u.username, u.email, u.balance, u.plan_expire, u.data_used, u.status, u.created_at, u.last_login,
              p.name as plan_name
       FROM users u
       LEFT JOIN plans p ON u.plan_id = p.id
       ORDER BY u.id ASC`
    );
    res.json({ success: true, data: users });
  } catch (error) {
    res.status(500).json({ success: false, message: '获取用户列表失败' });
  }
});

// 更新用户状态
app.put('/api/admin/users/:id/status', authAdmin, async (req, res) => {
  try {
    const { status } = req.body;
    await query('UPDATE users SET status = ? WHERE id = ?', [status, req.params.id]);
    res.json({ success: true, message: '更新成功' });
  } catch (error) {
    res.status(500).json({ success: false, message: '更新失败' });
  }
});

// 获取所有订单
app.get('/api/admin/orders', authAdmin, async (req, res) => {
  try {
    const orders = await query(
      `SELECT o.*, u.username, p.name as plan_name
       FROM orders o
       LEFT JOIN users u ON o.user_id = u.id
       LEFT JOIN plans p ON o.plan_id = p.id
       ORDER BY o.created_at DESC`
    );
    res.json({ success: true, data: orders });
  } catch (error) {
    res.status(500).json({ success: false, message: '获取订单失败' });
  }
});

// 更新订单状态
app.put('/api/admin/orders/:id/status', authAdmin, async (req, res) => {
  try {
    const { status } = req.body;
    await query('UPDATE orders SET status = ? WHERE id = ?', [status, req.params.id]);
    res.json({ success: true, message: '更新成功' });
  } catch (error) {
    res.status(500).json({ success: false, message: '更新失败' });
  }
});

// 获取系统配置
app.get('/api/admin/config/:key', authAdmin, async (req, res) => {
  try {
    const config = await queryOne('SELECT config_value FROM system_configs WHERE config_key = ?', [req.params.key]);
    if (!config) {
      return res.json({ success: true, data: null });
    }
    const value = typeof config.config_value === 'string' ? JSON.parse(config.config_value) : config.config_value;
    res.json({ success: true, data: value });
  } catch (error) {
    res.status(500).json({ success: false, message: '获取配置失败' });
  }
});

// 更新系统配置
app.put('/api/admin/config/:key', authAdmin, async (req, res) => {
  try {
    const { value } = req.body;
    await query(
      'INSERT INTO system_configs (config_key, config_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE config_value = ?, updated_at = NOW()',
      [req.params.key, JSON.stringify(value), JSON.stringify(value)]
    );
    res.json({ success: true, message: '配置已更新' });
  } catch (error) {
    res.status(500).json({ success: false, message: '更新配置失败' });
  }
});

// ============ 订阅路由 ============
app.get('/api/sub/:token', async (req, res) => {
  try {
    const user = await queryOne('SELECT id, status, plan_id FROM users WHERE subscription_token = ?', [req.params.token]);
    if (!user || user.status !== 'active') {
      return res.status(404).json({ success: false, message: '订阅无效' });
    }

    const nodes = await query(
      `SELECT n.* FROM nodes n
       INNER JOIN plan_nodes pn ON n.id = pn.node_id
       WHERE pn.plan_id = ? AND n.is_active = TRUE
       ORDER BY pn.priority ASC`,
      [user.plan_id]
    );

    // 根据 User-Agent 返回不同格式
    const ua = req.headers['user-agent'] || '';
    let content;
    let contentType = 'text/plain';

    if (ua.includes('Clash') || ua.includes('clash')) {
      // 返回 Clash 配置
      const { generateClashMetaConfig } = require('../../src/utils/subscription');
      content = generateClashMetaConfig(nodes);
      contentType = 'text/yaml';
    } else {
      // 默认返回 base64 编码的 URI 列表
      const { generateV2RayLink } = require('../../src/utils/subscription');
      content = generateV2RayLink(nodes);
      contentType = 'text/plain';
    }

    // 设置订阅信息头
    const plan = await queryOne('SELECT name, data_limit_gb FROM plans WHERE id = ?', [user.plan_id]);
    if (plan) {
      res.set('Subscription-Userinfo', `upload=0; download=0; total=${plan.data_limit_gb * 1024 * 1024 * 1024}; expire=${Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60}`);
    }

    res.set('Content-Type', contentType);
    res.send(content);
  } catch (error) {
    console.error('[Subscribe Error]', error);
    res.status(500).json({ success: false, message: '获取订阅失败' });
  }
});

// ============ 启动服务器 ============
async function startServer() {
  const dbReady = await initializeDatabase();
  
  if (!dbReady) {
    console.warn('[WARN] 数据库未连接，服务器将以演示模式运行（无数据库功能）');
  }

  app.listen(PORT, () => {
    console.log(`[Server] RocketStore API running on port ${PORT}`);
    console.log(`[Server] Environment: ${process.env.NODE_ENV || 'development'}`);
  });
}

startServer();

module.exports = app;
