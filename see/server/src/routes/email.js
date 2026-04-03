/**
 * 邮件路由 - 验证码发送、邮件配置管理
 */
const express = require('express');
const nodemailer = require('nodemailer');
const db = require('../config/database');

const router = express.Router();

// ============ 发送验证码 ============
router.post('/send-code', async (req, res) => {
  try {
    const { email, purpose = 'register' } = req.body;
    if (!email || !email.includes('@')) {
      return res.status(400).json({ success: false, message: '请输入有效的邮箱地址' });
    }

    // 检查邮件功能是否启用
    const configs = await db.query("SELECT config_key, config_value FROM system_configs WHERE config_key LIKE 'email_%'");
    const configMap = {};
    for (const c of configs) configMap[c.config_key] = c.config_value;

    if (configMap.email_enabled !== '1') {
      return res.json({ success: false, message: '邮件验证功能尚未启用' });
    }

    // 检查是否有未过期的验证码
    const now = new Date();
    const existingCodes = await db.query(
      'SELECT * FROM email_verification_codes WHERE email = ? AND purpose = ? AND is_used = 0 AND expires_at > ? ORDER BY created_at DESC LIMIT 1',
      [email, purpose, now]
    );

    if (existingCodes.length > 0) {
      const remaining = Math.ceil((new Date(existingCodes[0].expires_at).getTime() - now.getTime()) / 1000);
      return res.json({ success: false, message: `验证码已发送，请 ${remaining} 秒后再试` });
    }

    // 生成验证码
    const codeLength = parseInt(configMap.email_code_length || '6');
    const codeExpiry = parseInt(configMap.email_code_expiry || '5');
    const maxAttempts = parseInt(configMap.email_max_attempts || '5');
    const code = Math.floor(Math.random() * Math.pow(10, codeLength)).toString().padStart(codeLength, '0');
    const expiresAt = new Date(now.getTime() + codeExpiry * 60 * 1000);

    // 保存验证码
    await db.execute(
      'INSERT INTO email_verification_codes (email, code, purpose, expires_at, max_attempts, ip) VALUES (?, ?, ?, ?, ?, ?)',
      [email, code, purpose, expiresAt, maxAttempts, req.ip]
    );

    // 发送邮件
    try {
      const transporter = nodemailer.createTransport({
        host: configMap.email_smtp_host,
        port: parseInt(configMap.email_smtp_port || '465'),
        secure: configMap.email_smtp_secure === '1',
        auth: {
          user: configMap.email_smtp_user,
          pass: configMap.email_smtp_pass,
        },
      });

      const subject = configMap.email_verify_subject || '【RocketStore】邮箱验证码';
      const template = configMap.email_verify_template || '<p>您的验证码是：{code}</p>';
      const html = template.replace('{code}', code).replace('{expiry}', String(codeExpiry));

      await transporter.sendMail({
        from: `"${configMap.email_from_name || 'RocketStore'}" <${configMap.email_from_email}>`,
        to: email,
        subject,
        html,
      });

      res.json({ success: true, message: `验证码已发送至 ${email}` });
    } catch (emailError) {
      // 邮件发送失败，但验证码已保存（开发模式）
      console.log('[开发模式] 验证码:', code, '发送到:', email);
      res.json({ success: true, message: `验证码已生成（开发模式: ${code}）` });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: '发送验证码失败' });
  }
});

// ============ 验证验证码 ============
router.post('/verify-code', async (req, res) => {
  try {
    const { email, code, purpose = 'register' } = req.body;
    if (!email || !code) {
      return res.status(400).json({ success: false, message: '请提供邮箱和验证码' });
    }

    const now = new Date();
    const codes = await db.query(
      'SELECT * FROM email_verification_codes WHERE email = ? AND code = ? AND purpose = ? AND is_used = 0 AND expires_at > ? ORDER BY created_at DESC LIMIT 1',
      [email, code, purpose, now]
    );

    if (codes.length === 0) {
      // 增加尝试次数
      await db.execute(
        'UPDATE email_verification_codes SET attempts = attempts + 1 WHERE email = ? AND purpose = ? AND is_used = 0 AND expires_at > ?',
        [email, purpose, now]
      );
      return res.json({ success: false, message: '验证码无效或已过期' });
    }

    const vc = codes[0];
    if (vc.attempts >= vc.max_attempts) {
      return res.json({ success: false, message: '验证次数已达上限，请重新获取验证码' });
    }

    // 标记为已使用
    await db.execute('UPDATE email_verification_codes SET is_used = 1, used_at = NOW() WHERE id = ?', [vc.id]);

    res.json({ success: true, message: '验证成功' });
  } catch (error) {
    res.status(500).json({ success: false, message: '验证失败' });
  }
});

// ============ 测试邮件配置 ============
router.post('/test', async (req, res) => {
  try {
    const { smtpHost, smtpPort, smtpSecure, smtpUser, smtpPass, fromEmail, fromName, toEmail } = req.body;

    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: parseInt(smtpPort || '465'),
      secure: smtpSecure === true || smtpSecure === '1',
      auth: { user: smtpUser, pass: smtpPass },
    });

    await transporter.verify();

    await transporter.sendMail({
      from: `"${fromName || 'RocketStore'}" <${fromEmail}>`,
      to: toEmail || fromEmail,
      subject: '【RocketStore】SMTP 测试邮件',
      html: '<p>如果您收到此邮件，说明 SMTP 配置正确！</p>',
    });

    res.json({ success: true, message: '邮件发送成功' });
  } catch (error) {
    res.json({ success: false, message: error.message });
  }
});

// ============ 获取邮件配置 ============
router.get('/config', async (req, res) => {
  try {
    const configs = await db.query("SELECT config_key, config_value FROM system_configs WHERE config_key LIKE 'email_%'");
    const configMap = {};
    for (const c of configs) configMap[c.config_key] = c.config_value;
    res.json({ success: true, data: configMap });
  } catch (error) {
    res.status(500).json({ success: false, message: '获取配置失败' });
  }
});

// ============ 更新邮件配置 ============
router.put('/config', async (req, res) => {
  try {
    const updates = req.body;
    for (const [key, value] of Object.entries(updates)) {
      await db.execute(
        "INSERT INTO system_configs (config_key, config_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE config_value = ?",
        [key, String(value), String(value)]
      );
    }
    res.json({ success: true, message: '配置更新成功' });
  } catch (error) {
    res.status(500).json({ success: false, message: '更新配置失败' });
  }
});

module.exports = router;
