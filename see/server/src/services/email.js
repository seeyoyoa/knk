const nodemailer = require('nodemailer');
const { query, queryOne } = require('../config/database');

let transporter = null;

function createTransporter(config) {
  transporter = nodemailer.createTransport({
    host: config.smtpHost,
    port: config.smtpPort,
    secure: config.smtpSecure,
    auth: {
      user: config.smtpUser,
      pass: config.smtpPass,
    },
  });
  return transporter;
}

async function sendVerificationEmail(email, code, config) {
  if (!transporter) {
    createTransporter(config);
  }

  const subject = config.verifySubject || '【RocketStore】邮箱验证码';
  const html = (config.verifyTemplate || '<div style="text-align:center;font-size:24px">{code}</div>')
    .replace('{code}', code)
    .replace('{expiry}', config.codeExpiry || '5');

  await transporter.sendMail({
    from: `"${config.fromName || 'RocketStore'}" <${config.fromEmail}>`,
    to: email,
    subject,
    html,
  });
}

async function sendOrderConfirmationEmail(email, orderInfo, config) {
  if (!transporter) {
    createTransporter(config);
  }

  await transporter.sendMail({
    from: `"${config.fromName || 'RocketStore'}" <${config.fromEmail}>`,
    to: email,
    subject: '【RocketStore】订单确认',
    html: `
      <div style="max-width:500px;margin:0 auto;padding:20px;font-family:sans-serif">
        <h2 style="color:#8b5cf6">🚀 RocketStore 订单确认</h2>
        <p>感谢您的购买！</p>
        <div style="background:#1e1e2e;padding:16px;border-radius:8px;margin:16px 0">
          <p><strong>订单号：</strong>${orderInfo.outTradeNo}</p>
          <p><strong>套餐：</strong>${orderInfo.planName}</p>
          <p><strong>金额：</strong>¥${orderInfo.amount}</p>
          <p><strong>支付方式：</strong>${orderInfo.paymentMethod}</p>
        </div>
        <p style="color:#999;font-size:12px">套餐已自动开通，请登录用户面板查看</p>
      </div>
    `,
  });
}

async function sendPasswordResetEmail(email, code, config) {
  if (!transporter) {
    createTransporter(config);
  }

  await transporter.sendMail({
    from: `"${config.fromName || 'RocketStore'}" <${config.fromEmail}>`,
    to: email,
    subject: '【RocketStore】密码重置验证码',
    html: `
      <div style="max-width:400px;margin:0 auto;padding:20px;text-align:center">
        <h2 style="color:#8b5cf6">🔑 密码重置验证码</h2>
        <div style="font-size:36px;font-weight:bold;letter-spacing:8px;color:#8b5cf6;margin:20px 0">${code}</div>
        <p style="color:#999">验证码有效期为 ${config.codeExpiry || 5} 分钟</p>
      </div>
    `,
  });
}

module.exports = {
  createTransporter,
  sendVerificationEmail,
  sendOrderConfirmationEmail,
  sendPasswordResetEmail,
};
