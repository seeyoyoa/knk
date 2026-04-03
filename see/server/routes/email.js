/**
 * 邮件相关路由
 * 
 * POST /api/email/test          - 测试SMTP连接
 * POST /api/email/send-code     - 发送验证码邮件
 * POST /api/email/send          - 发送自定义邮件
 * GET  /api/email/config        - 获取邮件配置
 * POST /api/email/config        - 保存邮件配置
 */

const express = require('express');
const router = express.Router();
const emailService = require('../services/email');

// 内存存储邮件配置（实际应用中使用数据库）
let emailConfig = {
  smtpHost: '',
  smtpPort: 465,
  smtpSecure: true,
  smtpUser: '',
  smtpPass: '',
  fromName: 'RocketStore',
  fromEmail: 'noreply@rocketstore.com',
  verifySubject: '【RocketStore】邮箱验证码',
  verifyTemplate: '',
  codeLength: 6,
  codeExpiry: 5,
  maxAttempts: 5,
  isEnabled: false,
};

// 验证码存储（内存，实际应用中使用Redis/数据库）
const verificationCodes = new Map();

/**
 * 测试SMTP连接
 * POST /api/email/test
 */
router.post('/test', async (req, res) => {
  try {
    const { smtpHost, smtpPort, smtpSecure, smtpUser, smtpPass, fromEmail, toEmail } = req.body;

    if (!smtpHost || !smtpUser || !smtpPass) {
      return res.json({
        success: false,
        message: '请填写完整的SMTP配置',
      });
    }

    const result = await emailService.testSMTPConnection({
      host: smtpHost,
      port: parseInt(smtpPort) || 465,
      secure: smtpSecure !== false,
      user: smtpUser,
      pass: smtpPass,
    });

    if (result.success) {
      // 发送测试邮件
      const testResult = await emailService.sendEmail(
        {
          host: smtpHost,
          port: parseInt(smtpPort) || 465,
          secure: smtpSecure !== false,
          user: smtpUser,
          pass: smtpPass,
        },
        {
          to: toEmail || smtpUser,
          subject: '【RocketStore】SMTP测试邮件',
          html: `
            <div style="max-width:400px;margin:0 auto;padding:20px;background:#1e1e2e;border-radius:12px;color:#fff;text-align:center">
              <h2 style="color:#8b5cf6">✅ SMTP连接测试成功</h2>
              <p>如果您收到此邮件，说明SMTP配置正确</p>
              <p style="color:#888;font-size:12px">${new Date().toLocaleString('zh-CN')}</p>
            </div>
          `,
          fromName: fromEmail ? fromEmail.split('@')[0] : 'RocketStore',
          fromEmail: fromEmail || smtpUser,
        }
      );

      return res.json(testResult);
    } else {
      return res.json(result);
    }
  } catch (error) {
    return res.json({
      success: false,
      message: `测试失败: ${error.message}`,
    });
  }
});

/**
 * 发送验证码邮件
 * POST /api/email/send-code
 */
router.post('/send-code', async (req, res) => {
  try {
    const { email, code, subject, template, expiry, smtpConfig } = req.body;

    if (!email || !code) {
      return res.json({
        success: false,
        message: '缺少必要参数',
      });
    }

    if (!smtpConfig || !smtpConfig.host || !smtpConfig.user || !smtpConfig.pass) {
      return res.json({
        success: false,
        message: 'SMTP配置不完整',
      });
    }

    // 检查发送频率（防止滥用）
    const lastSent = verificationCodes.get(email);
    if (lastSent && Date.now() - lastSent.time < 60000) {
      const remaining = Math.ceil((60000 - (Date.now() - lastSent.time)) / 1000);
      return res.json({
        success: false,
        message: `请 ${remaining} 秒后再试`,
      });
    }

    const result = await emailService.sendVerificationCode(
      {
        host: smtpConfig.host,
        port: parseInt(smtpConfig.port) || 465,
        secure: smtpConfig.secure !== false,
        user: smtpConfig.user,
        pass: smtpConfig.pass,
      },
      {
        to: email,
        code,
        subject: subject || '【RocketStore】邮箱验证码',
        template: template,
        expiry: expiry || 5,
        fromName: smtpConfig.fromName || 'RocketStore',
        fromEmail: smtpConfig.fromEmail || smtpConfig.user,
      }
    );

    if (result.success) {
      verificationCodes.set(email, {
        code,
        time: Date.now(),
        attempts: 0,
      });
    }

    return res.json(result);
  } catch (error) {
    return res.json({
      success: false,
      message: `发送失败: ${error.message}`,
    });
  }
});

/**
 * 验证验证码
 * POST /api/email/verify-code
 */
router.post('/verify-code', async (req, res) => {
  try {
    const { email, code, purpose } = req.body;

    if (!email || !code) {
      return res.json({
        success: false,
        message: '缺少必要参数',
      });
    }

    const stored = verificationCodes.get(email);

    if (!stored) {
      return res.json({
        success: false,
        message: '请先获取验证码',
      });
    }

    // 检查是否过期（5分钟）
    if (Date.now() - stored.time > 5 * 60 * 1000) {
      verificationCodes.delete(email);
      return res.json({
        success: false,
        message: '验证码已过期',
      });
    }

    // 检查尝试次数
    if (stored.attempts >= 5) {
      verificationCodes.delete(email);
      return res.json({
        success: false,
        message: '验证次数已达上限，请重新获取验证码',
      });
    }

    if (stored.code !== code) {
      stored.attempts++;
      return res.json({
        success: false,
        message: `验证码错误，还剩 ${5 - stored.attempts} 次机会`,
      });
    }

    // 验证成功
    verificationCodes.delete(email);
    return res.json({
      success: true,
      message: '验证成功',
    });
  } catch (error) {
    return res.json({
      success: false,
      message: `验证失败: ${error.message}`,
    });
  }
});

/**
 * 获取邮件配置
 * GET /api/email/config
 */
router.get('/config', (req, res) => {
  return res.json({
    success: true,
    data: {
      ...emailConfig,
      smtpPass: emailConfig.smtpPass ? '********' : '', // 隐藏密码
    },
  });
});

/**
 * 保存邮件配置
 * POST /api/email/config
 */
router.post('/config', (req, res) => {
  try {
    const config = req.body;

    emailConfig = {
      ...emailConfig,
      ...config,
    };

    return res.json({
      success: true,
      message: '邮件配置保存成功',
    });
  } catch (error) {
    return res.json({
      success: false,
      message: `保存失败: ${error.message}`,
    });
  }
});

/**
 * 发送自定义邮件
 * POST /api/email/send
 */
router.post('/send', async (req, res) => {
  try {
    const { to, subject, html, text, smtpConfig } = req.body;

    if (!to || !subject) {
      return res.json({
        success: false,
        message: '缺少必要参数',
      });
    }

    if (!smtpConfig || !smtpConfig.host) {
      return res.json({
        success: false,
        message: 'SMTP配置不完整',
      });
    }

    const result = await emailService.sendEmail(
      {
        host: smtpConfig.host,
        port: parseInt(smtpConfig.port) || 465,
        secure: smtpConfig.secure !== false,
        user: smtpConfig.user,
        pass: smtpConfig.pass,
      },
      {
        to,
        subject,
        html,
        text,
        fromName: smtpConfig.fromName || 'RocketStore',
        fromEmail: smtpConfig.fromEmail || smtpConfig.user,
      }
    );

    return res.json(result);
  } catch (error) {
    return res.json({
      success: false,
      message: `发送失败: ${error.message}`,
    });
  }
});

module.exports = router;
