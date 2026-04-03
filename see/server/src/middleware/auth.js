const jwt = require('jsonwebtoken');
const { queryOne } = require('../config/database');

const JWT_SECRET = process.env.JWT_SECRET || 'rocketstore-jwt-secret-key-2026';
const JWT_EXPIRES_IN = '7d';

function generateToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

function verifyToken(token) {
  return jwt.verify(token, JWT_SECRET);
}

// 用户认证中间件
async function authUser(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, message: '未提供认证令牌' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = verifyToken(token);

    if (decoded.type !== 'user') {
      return res.status(401).json({ success: false, message: '无效的令牌类型' });
    }

    const user = await queryOne('SELECT id, username, email, balance, plan_id, plan_expire, data_used, subscription_token, status FROM users WHERE id = ?', [decoded.id]);
    
    if (!user) {
      return res.status(401).json({ success: false, message: '用户不存在' });
    }

    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ success: false, message: '令牌已过期' });
    }
    return res.status(401).json({ success: false, message: '认证失败' });
  }
}

// 管理员认证中间件
async function authAdmin(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, message: '未提供认证令牌' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = verifyToken(token);

    if (decoded.type !== 'admin') {
      return res.status(401).json({ success: false, message: '无效的管理员令牌' });
    }

    const admin = await queryOne('SELECT id, username, role FROM admins WHERE id = ?', [decoded.id]);
    
    if (!admin) {
      return res.status(401).json({ success: false, message: '管理员不存在' });
    }

    req.admin = admin;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ success: false, message: '令牌已过期' });
    }
    return res.status(401).json({ success: false, message: '认证失败' });
  }
}

// 可选认证中间件（不强制要求登录）
function optionalAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      const decoded = verifyToken(token);
      req.user = decoded;
    }
    next();
  } catch {
    next();
  }
}

module.exports = {
  generateToken,
  verifyToken,
  authUser,
  authAdmin,
  optionalAuth,
  // 别名导出 - 兼容 routes 中使用的名称
  authenticate: authUser,
  requireAdmin: authAdmin,
  JWT_SECRET,
};
