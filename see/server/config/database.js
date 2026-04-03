// 数据库配置和初始化
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const crypto = require('crypto');

const DB_PATH = path.join(__dirname, '../../data/database.db');

let db;

function getDb() {
  if (!db) {
    db = new sqlite3.Database(DB_PATH, (err) => {
      if (err) {
        console.error('❌ Database connection error:', err.message);
      } else {
        console.log('✅ Database connected');
      }
    });
    db.configure('busyTimeout', 10000);
  }
  return db;
}

function initDatabase() {
  const database = getDb();
  
  // 创建表
  database.serialize(() => {
    // 用户表
    database.run(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        email TEXT UNIQUE,
        phone TEXT,
        password TEXT NOT NULL,
        balance REAL DEFAULT 0,
        plan_id TEXT,
        plan_expire TEXT,
        data_used REAL DEFAULT 0,
        data_limit REAL DEFAULT 0,
        subscription_token TEXT,
        status TEXT DEFAULT 'active',
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        last_login TEXT
      )
    `);

    // 管理员表
    database.run(`
      CREATE TABLE IF NOT EXISTS admins (
        id TEXT PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        role TEXT DEFAULT 'admin',
        last_login TEXT
      )
    `);

    // 套餐表
    database.run(`
      CREATE TABLE IF NOT EXISTS plans (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        price REAL NOT NULL,
        duration INTEGER NOT NULL,
        data_limit REAL NOT NULL,
        speed_limit INTEGER,
        node_groups TEXT,
        features TEXT,
        is_popular INTEGER DEFAULT 0,
        is_active INTEGER DEFAULT 1,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 节点表
    database.run(`
      CREATE TABLE IF NOT EXISTS nodes (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        type TEXT NOT NULL,
        server TEXT NOT NULL,
        port INTEGER NOT NULL,
        country TEXT,
        country_code TEXT,
        flag TEXT,
        group_name TEXT,
        config TEXT,
        is_active INTEGER DEFAULT 1,
        custom_name TEXT,
        latency INTEGER,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 套餐节点关联表
    database.run(`
      CREATE TABLE IF NOT EXISTS plan_nodes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        plan_id TEXT NOT NULL,
        node_id TEXT NOT NULL,
        custom_name TEXT,
        priority INTEGER DEFAULT 0,
        FOREIGN KEY (plan_id) REFERENCES plans(id),
        FOREIGN KEY (node_id) REFERENCES nodes(id)
      )
    `);

    // 订单表
    database.run(`
      CREATE TABLE IF NOT EXISTS orders (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        plan_id TEXT NOT NULL,
        amount REAL NOT NULL,
        status TEXT DEFAULT 'pending',
        payment_method TEXT,
        payment_trade_no TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        paid_at TEXT,
        FOREIGN KEY (user_id) REFERENCES users(id),
        FOREIGN KEY (plan_id) REFERENCES plans(id)
      )
    `);

    // 支付记录表
    database.run(`
      CREATE TABLE IF NOT EXISTS payments (
        id TEXT PRIMARY KEY,
        order_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        amount REAL NOT NULL,
        currency TEXT DEFAULT 'CNY',
        method TEXT NOT NULL,
        status TEXT DEFAULT 'pending',
        trade_no TEXT,
        qr_code TEXT,
        notify_data TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        paid_at TEXT,
        confirmed_at TEXT,
        FOREIGN KEY (order_id) REFERENCES orders(id),
        FOREIGN KEY (user_id) REFERENCES users(id)
      )
    `);

    // 支付配置表
    database.run(`
      CREATE TABLE IF NOT EXISTS payment_config (
        id TEXT PRIMARY KEY,
        config_type TEXT NOT NULL,
        config_key TEXT NOT NULL,
        config_value TEXT,
        is_encrypted INTEGER DEFAULT 0,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 订阅源表
    database.run(`
      CREATE TABLE IF NOT EXISTS subscriptions (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        url TEXT NOT NULL,
        source TEXT,
        is_active INTEGER DEFAULT 1,
        last_sync TEXT,
        node_count INTEGER DEFAULT 0,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 日志表
    database.run(`
      CREATE TABLE IF NOT EXISTS logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        type TEXT NOT NULL,
        message TEXT,
        data TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 插入默认管理员
    const adminId = crypto.randomUUID();
    const adminPassword = crypto.createHash('sha256').update('admin123').digest('hex');
    database.run(`
      INSERT OR IGNORE INTO admins (id, username, password, role) 
      VALUES (?, ?, ?, 'superadmin')
    `, [adminId, 'admin', adminPassword]);

    // 插入默认套餐
    const plans = [
      { id: crypto.randomUUID(), name: '月付基础版', price: 29.9, duration: 30, data_limit: 100, speed_limit: 100, features: '["100GB流量","100Mbps限速","基础节点"]' },
      { id: crypto.randomUUID(), name: '月付高级版', price: 59.9, duration: 30, data_limit: 500, speed_limit: 500, features: '["500GB流量","500Mbps限速","高级节点","多设备"]', is_popular: 1 },
      { id: crypto.randomUUID(), name: '年付尊享版', price: 599, duration: 365, data_limit: 2000, speed_limit: 1000, features: '["2TB流量","1Gbps限速","全部节点","无限设备","专属客服"]' }
    ];

    plans.forEach(plan => {
      database.run(`
        INSERT OR IGNORE INTO plans (id, name, price, duration, data_limit, speed_limit, features, is_popular)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `, [plan.id, plan.name, plan.price, plan.duration, plan.data_limit, plan.speed_limit, plan.features, plan.is_popular || 0]);
    });

    console.log('✅ Database initialized successfully');
  });
}

function query(sql, params = []) {
  return new Promise((resolve, reject) => {
    const database = getDb();
    database.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    const database = getDb();
    database.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    const database = getDb();
    database.run(sql, params, function(err) {
      if (err) reject(err);
      else resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
}

module.exports = { getDb, initDatabase, query, get, run };
