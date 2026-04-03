const mysql = require('mysql2/promise');
require('dotenv').config();

let pool;

async function initializeDatabase() {
  try {
    pool = mysql.createPool({
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '3306'),
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'rocketstore',
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      enableKeepAlive: true,
      keepAliveInitialDelay: 0,
    });

    // 测试连接
    const connection = await pool.getConnection();
    console.log('[MySQL] 数据库连接成功');
    connection.release();
    return true;
  } catch (error) {
    console.error('[MySQL] 数据库连接失败:', error.message);
    return false;
  }
}

function getPool() {
  if (!pool) {
    throw new Error('数据库未初始化');
  }
  return pool;
}

async function query(sql, params = []) {
  const pool = getPool();
  const [rows] = await pool.execute(sql, params);
  return rows;
}

async function queryOne(sql, params = []) {
  const rows = await query(sql, params);
  return Array.isArray(rows) ? rows[0] : rows;
}

module.exports = {
  initializeDatabase,
  getPool,
  query,
  queryOne,
};
