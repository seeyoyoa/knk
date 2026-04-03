/**
 * 邮件服务 - 基于 SMTP 发送邮件
 * 
 * 功能：
 * - SMTP 连接和邮件发送
 * - 验证码邮件模板渲染
 * - 连接测试
 * 
 * 依赖: nodemailer
 * 安装: npm install nodemailer
 */

const nodemailer = require('nodemailer');

// 邮件发送器缓存（避免重复创建连接）
let transporterCache = {};

/**
 * 创建 SMTP 传输器
 */
function createTransporter(config) {
  const cacheKey = `${config.host}:${config.port}:${config.user}`;
  
  if (transporterCache[cacheKey]) {
    return transporterCache[cacheKey];
  }

  const transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure, // true for 465, false for 587
    auth: {
      user: config.user,
      pass: config.pass,
    },
    tls: {
      rejectUnauthorized: false, // 允许自签名证书
    },
    pool: true, // 使用连接池
    maxConnections: 5,
    maxMessages: 100,
  });

  transporterCache[cacheKey] = transporter;
  return transporter;
}

/**
 * 渲染邮件模板
 */
function renderTemplate(template, variables) {
  let html = template;
  for (const [key, value] of Object.entries(variables)) {
    html = html.replace(new RegExp(`\\{${key}\\}`, 'g'), value);
  }
  return html;
}

/**
 * 测试 SMTP 连接
 */
async function testSMTPConnection(config) {
  try {
    const transporter = createTransporter(config);
    await transporter.verify();
    return {
      success: true,
      message: 'SMTP 连接成功',
    };
  } catch (error) {
    return {
      success: false,
      message: `SMTP 连接失败: ${error.message}`,
    };
  }
}

/**
 * 发送验证码邮件
 */
async function sendVerificationCode(config, options) {
  const {
    to,
    code,
    subject = '【RocketStore】邮箱验证码',
    template,
    expiry = 5,
    fromName = 'RocketStore',
    fromEmail,
  } = options;

  try {
    const transporter = createTransporter(config);

    // 渲染模板
    const html = renderTemplate(template || defaultTemplate, {
      code,
      expiry: String(expiry),
    });

    const info = await transporter.sendMail({
      from: `"${fromName}" <${fromEmail}>`,
      to,
      subject,
      html,
      // 纯文本备用
      text: `您的验证码是: ${code}\n有效期: ${expiry} 分钟\n请勿将验证码告知他人。`,
    });

    console.log(`[邮件服务] 验证码邮件已发送至 ${to}, messageId: ${info.messageId}`);

    return {
      success: true,
      messageId: info.messageId,
      message: '验证码邮件发送成功',
    };
  } catch (error) {
    console.error(`[邮件服务] 发送验证码邮件失败: ${error.message}`);
    return {
      success: false,
      message: `邮件发送失败: ${error.message}`,
    };
  }
}

/**
 * 发送自定义邮件
 */
async function sendEmail(config, options) {
  const {
    to,
    subject,
    html,
    text,
    fromName,
    fromEmail,
  } = options;

  try {
    const transporter = createTransporter(config);

    const info = await transporter.sendMail({
      from: `"${fromName}" <${fromEmail}>`,
      to,
      subject,
      html,
      text,
    });

    return {
      success: true,
      messageId: info.messageId,
      message: '邮件发送成功',
    };
  } catch (error) {
    return {
      success: false,
      message: `邮件发送失败: ${error.message}`,
    };
  }
}

/**
 * 发送订单确认邮件
 */
async function sendOrderConfirmation(config, options) {
  const { to, orderInfo, fromName, fromEmail } = options;

  const html = `
    <div style="max-width:500px;margin:0 auto;padding:24px;background:#1e1e2e;border-radius:12px;color:#fff;font-family:system-ui">
      <h2 style="text-align:center;color:#8b5cf6">🚀 RocketStore - 订单确认</h2>
      <div style="background:#2a2a3e;padding:16px;border-radius:8px;margin:16px 0">
        <p style="margin:8px 0"><strong>订单号:</strong> ${orderInfo.orderId}</p>
        <p style="margin:8px 0"><strong>套餐:</strong> ${orderInfo.planName}</p>
        <p style="margin:8px 0"><strong>金额:</strong> ¥${orderInfo.amount}</p>
        <p style="margin:8px 0"><strong>支付方式:</strong> ${orderInfo.paymentMethod}</p>
        <p style="margin:8px 0"><strong>到期时间:</strong> ${orderInfo.expireDate}</p>
      </div>
      <p style="text-align:center;color:#999;font-size:12px">感谢您的购买！如有问题请联系客服。</p>
    </div>
  `;

  return sendEmail(config, {
    to,
    subject: '【RocketStore】订单确认通知',
    html,
    fromName,
    fromEmail,
  });
}

/**
 * 发送密码重置邮件
 */
async function sendPasswordReset(config, options) {
  const { to, code, resetLink, fromName, fromEmail } = options;

  const html = `
    <div style="max-width:500px;margin:0 auto;padding:24px;background:#1e1e2e;border-radius:12px;color:#fff;font-family:system-ui">
      <h2 style="text-align:center;color:#8b5cf6">🔐 RocketStore - 密码重置</h2>
      <p>您正在重置密码，验证码为：</p>
      <div style="text-align:center;font-size:32px;font-weight:bold;letter-spacing:6px;color:#8b5cf6;background:#2a2a3e;padding:16px;border-radius:8px;margin:16px 0">${code}</div>
      <p style="text-align:center;color:#999;font-size:12px">或点击链接重置：<a href="${resetLink}" style="color:#8b5cf6">${resetLink}</a></p>
      <p style="text-align:center;color:#999;font-size:12px">如果您没有请求重置密码，请忽略此邮件。</p>
    </div>
  `;

  return sendEmail(config, {
    to,
    subject: '【RocketStore】密码重置',
    html,
    fromName,
    fromEmail,
  });
}

// 默认验证码邮件模板
const defaultTemplate = `
<div style="max-width:400px;margin:0 auto;padding:24px;background:#1e1e2e;border-radius:12px;color:#fff;font-family:system-ui,-apple-system,sans-serif">
  <div style="text-align:center;margin-bottom:20px">
    <span style="font-size:40px">🚀</span>
    <h2 style="margin:8px 0 0;color:#8b5cf6">RocketStore</h2>
  </div>
  <p style="text-align:center;color:#ccc;margin-bottom:20px">您的邮箱验证码是：</p>
  <div style="text-align:center;font-size:36px;font-weight:bold;letter-spacing:8px;color:#8b5cf6;background:#2a2a3e;padding:20px;border-radius:10px;margin:0 0 20px;border:1px solid #8b5cf6/30">{code}</div>
  <p style="text-align:center;color:#888;font-size:13px;margin-bottom:8px">验证码有效期为 <strong style="color:#8b5cf6">{expiry}</strong> 分钟</p>
  <p style="text-align:center;color:#666;font-size:12px;margin-top:16px;padding-top:16px;border-top:1px solid #333">请勿将验证码告知他人，如非本人操作请忽略此邮件</p>
</div>
`;

module.exports = {
  testSMTPConnection,
  sendVerificationCode,
  sendEmail,
  sendOrderConfirmation,
  sendPasswordReset,
  renderTemplate,
};
