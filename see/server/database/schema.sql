-- RocketStore 机场订阅管理系统 - MySQL 8.0 数据库架构
-- 创建时间: 2026-01-15
-- MySQL 版本要求: 8.0+

CREATE DATABASE IF NOT EXISTS rocketstore 
  CHARACTER SET utf8mb4 
  COLLATE utf8mb4_unicode_ci;

USE rocketstore;

-- 管理员表
CREATE TABLE IF NOT EXISTS admins (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(50) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('superadmin', 'admin', 'operator') DEFAULT 'admin',
  email VARCHAR(100),
  last_login DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_username (username),
  INDEX idx_role (role)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 用户表
CREATE TABLE IF NOT EXISTS users (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(50) NOT NULL UNIQUE,
  email VARCHAR(100) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  balance DECIMAL(10,2) DEFAULT 0.00,
  plan_id INT UNSIGNED,
  plan_expire DATE,
  data_used DECIMAL(10,2) DEFAULT 0.00,
  subscription_token VARCHAR(64) UNIQUE,
  status ENUM('active', 'suspended', 'expired') DEFAULT 'active',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  last_login DATETIME,
  INDEX idx_username (username),
  INDEX idx_email (email),
  INDEX idx_status (status),
  INDEX idx_plan_id (plan_id),
  INDEX idx_subscription_token (subscription_token)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 套餐表
CREATE TABLE IF NOT EXISTS plans (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  price DECIMAL(10,2) NOT NULL,
  duration_days INT NOT NULL DEFAULT 30,
  data_limit_gb INT NOT NULL,
  speed_limit_mbps INT DEFAULT 0,
  node_groups JSON,
  features JSON,
  is_popular BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_is_active (is_active),
  INDEX idx_price (price)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 订阅源表
CREATE TABLE IF NOT EXISTS subscriptions (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  url TEXT NOT NULL,
  source VARCHAR(100),
  is_active BOOLEAN DEFAULT TRUE,
  last_sync DATE,
  node_count INT DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_is_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 节点表
CREATE TABLE IF NOT EXISTS nodes (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(200) NOT NULL,
  type ENUM('ss','ssr','vmess','vless','trojan','hysteria','hysteria2','tuic','wireguard','snell','ssh','http','socks5','direct') NOT NULL,
  server VARCHAR(255) NOT NULL,
  port INT UNSIGNED NOT NULL,
  uuid VARCHAR(255),
  alter_id INT DEFAULT 0,
  protocol VARCHAR(50),
  network VARCHAR(50),
  tls BOOLEAN DEFAULT FALSE,
  country VARCHAR(50),
  country_code VARCHAR(10),
  flag VARCHAR(10),
  node_group VARCHAR(50),
  latency INT,
  is_active BOOLEAN DEFAULT TRUE,
  custom_name VARCHAR(200),
  cipher VARCHAR(50),
  password VARCHAR(255),
  sni VARCHAR(255),
  path VARCHAR(500),
  host VARCHAR(255),
  flow VARCHAR(50),
  encryption VARCHAR(50),
  auth VARCHAR(255),
  alpn VARCHAR(50),
  congestion_controller VARCHAR(50),
  private_key TEXT,
  public_key TEXT,
  subscription_id INT UNSIGNED,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_type (type),
  INDEX idx_country_code (country_code),
  INDEX idx_is_active (is_active),
  INDEX idx_subscription_id (subscription_id),
  INDEX idx_node_group (node_group)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 套餐-节点关联表
CREATE TABLE IF NOT EXISTS plan_nodes (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  plan_id INT UNSIGNED NOT NULL,
  node_id INT UNSIGNED NOT NULL,
  custom_name VARCHAR(200),
  priority INT DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY unique_plan_node (plan_id, node_id),
  INDEX idx_plan_id (plan_id),
  INDEX idx_node_id (node_id),
  FOREIGN KEY (plan_id) REFERENCES plans(id) ON DELETE CASCADE,
  FOREIGN KEY (node_id) REFERENCES nodes(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 订单表
CREATE TABLE IF NOT EXISTS orders (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL,
  plan_id INT UNSIGNED NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  status ENUM('pending','paid','processing','completed','cancelled') DEFAULT 'pending',
  payment_method VARCHAR(50),
  out_trade_no VARCHAR(100) UNIQUE,
  trade_no VARCHAR(100),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  paid_at DATETIME,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_user_id (user_id),
  INDEX idx_status (status),
  INDEX idx_out_trade_no (out_trade_no),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (plan_id) REFERENCES plans(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 充值记录表
CREATE TABLE IF NOT EXISTS recharges (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  currency VARCHAR(10) DEFAULT 'CNY',
  payment_method ENUM('alipay','usdt','wechat','balance') NOT NULL,
  status ENUM('pending','paid','confirmed','failed','expired') DEFAULT 'pending',
  transaction_id VARCHAR(255),
  qr_code TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  paid_at DATETIME,
  confirmed_at DATETIME,
  notes TEXT,
  INDEX idx_user_id (user_id),
  INDEX idx_status (status),
  INDEX idx_payment_method (payment_method),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 邮箱验证码表
CREATE TABLE IF NOT EXISTS email_verification_codes (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(100) NOT NULL,
  code VARCHAR(10) NOT NULL,
  purpose ENUM('register','reset_password','login') NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  expires_at DATETIME NOT NULL,
  attempts INT DEFAULT 0,
  max_attempts INT DEFAULT 5,
  is_used BOOLEAN DEFAULT FALSE,
  used_at DATETIME,
  ip VARCHAR(45),
  INDEX idx_email (email),
  INDEX idx_code (code),
  INDEX idx_expires_at (expires_at),
  INDEX idx_is_used (is_used)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 系统配置表
CREATE TABLE IF NOT EXISTS system_configs (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  config_key VARCHAR(100) NOT NULL UNIQUE,
  config_value JSON,
  description TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_config_key (config_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 操作日志表
CREATE TABLE IF NOT EXISTS audit_logs (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED,
  action VARCHAR(100) NOT NULL,
  resource VARCHAR(100),
  resource_id INT UNSIGNED,
  details JSON,
  ip VARCHAR(45),
  user_agent TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_user_id (user_id),
  INDEX idx_action (action),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 插入默认管理员 (密码: admin123, 使用 bcrypt 哈希)
INSERT INTO admins (username, password_hash, role) VALUES 
('admin', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5GyYILp92S.0i', 'superadmin');

-- 插入默认套餐
INSERT INTO plans (name, price, duration_days, data_limit_gb, speed_limit_mbps, node_groups, features, is_popular) VALUES
('入门版', 15.90, 30, 80, 100, '["HK", "JP"]', '["80GB流量/月", "客服支持", "自动续费"]', FALSE),
('基础版', 25.90, 30, 160, 200, '["HK", "JP", "US"]', '["160GB流量/月", "客服支持", "优先客服", "自动续费"]', TRUE),
('标准版', 35.90, 30, 300, 500, '["HK", "JP", "US", "SG"]', '["300GB流量/月", "7x24客服", "优先客服", "自动续费"]', FALSE),
('旗舰版', 55.90, 30, 500, 1000, '["HK", "JP", "US", "SG", "KR", "GB"]', '["500GB流量/月", "7x24客服", "专属客服", "自动续费", "SSTap支持"]', FALSE);

-- 插入默认订阅源
INSERT INTO subscriptions (name, url, source, is_active, node_count) VALUES
('机场A', 'https://example.com/sub/a', '机场A', TRUE, 8),
('机场B', 'https://example.com/sub/b', '机场B', TRUE, 6);

-- 插入默认节点
INSERT INTO nodes (name, type, server, port, uuid, network, tls, country, country_code, flag, node_group, is_active, subscription_id, cipher, sni, path, host) VALUES
('🇭🇰 香港 01', 'vmess', 'hk1.example.com', 443, 'abc123', 'ws', TRUE, '香港', 'HK', '🇭🇰', 'HK', TRUE, 1, 'auto', 'hk1.example.com', '/vmess', 'hk1.example.com'),
('🇯🇵 日本 01', 'ss', 'jp1.example.com', 443, NULL, 'tcp', FALSE, '日本', 'JP', '🇯🇵', 'JP', TRUE, 1, 'aes-256-gcm', NULL, NULL, NULL),
('🇺🇸 美国 01', 'trojan', 'us1.example.com', 443, NULL, 'tcp', TRUE, '美国', 'US', '🇺🇸', 'US', TRUE, 1, NULL, 'us1.example.com', NULL, NULL),
('🇸🇬 新加坡 01', 'vmess', 'sg1.example.com', 443, 'jkl012', 'ws', TRUE, '新加坡', 'SG', '🇸🇬', 'SG', TRUE, 1, 'auto', 'sg1.example.com', '/vmess', 'sg1.example.com'),
('🇭🇰 香港 02', 'ss', 'hk2.example.com', 8388, NULL, 'tcp', FALSE, '香港', 'HK', '🇭🇰', 'HK', TRUE, 1, 'aes-256-gcm', NULL, NULL, NULL),
('🇯🇵 日本 02', 'vmess', 'jp2.example.com', 443, 'pqr678', 'ws', TRUE, '日本', 'JP', '🇯🇵', 'JP', TRUE, 1, 'auto', 'jp2.example.com', '/vmess', 'jp2.example.com'),
('🇰🇷 韩国 01', 'trojan', 'kr1.example.com', 443, NULL, 'tcp', TRUE, '韩国', 'KR', '🇰🇷', 'KR', TRUE, 1, NULL, 'kr1.example.com', NULL, NULL),
('🇬🇧 英国 01', 'vmess', 'uk1.example.com', 443, 'vwx234', 'ws', TRUE, '英国', 'GB', '🇬🇧', 'GB', TRUE, 1, 'auto', 'uk1.example.com', '/vmess', 'uk1.example.com'),
('🇭🇰 香港 VLESS', 'vless', 'hkvless.example.com', 443, 'vless-uuid-hk-001', 'ws', TRUE, '香港', 'HK', '🇭🇰', 'HK', TRUE, 2, NULL, 'hkvless.example.com', '/vless', 'hkvless.example.com'),
('🇺🇸 美国 VLESS', 'vless', 'usvless.example.com', 443, 'vless-uuid-us-001', 'ws', TRUE, '美国', 'US', '🇺🇸', 'US', TRUE, 2, NULL, 'usvless.example.com', '/vless', 'usvless.example.com'),
('🇯🇵 日本 Hysteria2', 'hysteria2', 'jphy.example.com', 8443, NULL, NULL, TRUE, '日本', 'JP', '🇯🇵', 'JP', TRUE, 2, NULL, 'jphy.example.com', NULL, NULL),
('🇸🇬 新加坡 Hysteria2', 'hysteria2', 'sghy.example.com', 8443, NULL, NULL, TRUE, '新加坡', 'SG', '🇸🇬', 'SG', TRUE, 2, NULL, 'sghy.example.com', NULL, NULL),
('🇭🇰 香港 TUIC', 'tuic', 'hktuic.example.com', 9443, 'tuic-uuid-hk-001', NULL, TRUE, '香港', 'HK', '🇭🇰', 'HK', TRUE, 2, NULL, 'hktuic.example.com', NULL, NULL),
('🇺🇸 美国 TUIC', 'tuic', 'ustuic.example.com', 9443, 'tuic-uuid-us-001', NULL, TRUE, '美国', 'US', '🇺🇸', 'US', TRUE, 2, NULL, 'ustuic.example.com', NULL, NULL);

-- 插入套餐-节点关联
INSERT INTO plan_nodes (plan_id, node_id, priority) VALUES
(1, 1, 1), (1, 2, 2),
(2, 1, 1), (2, 2, 2), (2, 3, 3),
(3, 1, 1), (3, 2, 2), (3, 3, 3), (3, 4, 4),
(4, 1, 1), (4, 2, 2), (4, 3, 3), (4, 4, 4), (4, 5, 5), (4, 6, 6), (4, 7, 7), (4, 8, 8);

-- 插入测试用户 (密码: test123 / vip123, 使用 bcrypt 哈希)
INSERT INTO users (username, email, password_hash, balance, plan_id, plan_expire, data_used, subscription_token, status) VALUES
('testuser', 'test@example.com', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5GyYILp92S.0i', 0, 2, '2026-02-15', 45.6, 'abc123def456', 'active'),
('vipuser', 'vip@example.com', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5GyYILp92S.0i', 100, 4, '2026-03-01', 120.3, 'ghi789jkl012', 'active');

-- 插入默认订单
INSERT INTO orders (user_id, plan_id, amount, status, payment_method, out_trade_no, created_at, paid_at) VALUES
(1, 2, 25.90, 'completed', 'alipay', 'ALIPAY20260101001', '2026-01-01', '2026-01-01'),
(2, 4, 55.90, 'completed', 'wechat', 'WECHAT20251215001', '2025-12-15', '2025-12-15');

-- 插入支付配置
INSERT INTO system_configs (config_key, config_value, description) VALUES
('payment_config', '{"alipay":{"enabled":false,"appId":"","privateKey":"","alipayPublicKey":"","notifyUrl":"","returnUrl":"","sellerEmail":""},"usdt":{"enabled":false,"network":"TRC20","walletAddress":"","apiKey":"","apiSecret":"","notifyUrl":"","minAmount":10},"currency":"CNY","exchangeRate":0.14,"autoConfirm":true,"timeout":30}', '支付配置'),
('email_config', '{"smtpHost":"","smtpPort":465,"smtpSecure":true,"smtpUser":"","smtpPass":"","fromName":"RocketStore","fromEmail":"noreply@rocketstore.com","isEnabled":false,"codeLength":6,"codeExpiry":5,"maxAttempts":5}', '邮件配置');

-- 创建视图：用户套餐信息
CREATE OR REPLACE VIEW v_user_plans AS
SELECT 
  u.id as user_id,
  u.username,
  u.email,
  u.status,
  u.balance,
  u.data_used,
  u.plan_expire,
  u.subscription_token,
  p.id as plan_id,
  p.name as plan_name,
  p.price as plan_price,
  p.data_limit_gb,
  p.speed_limit_mbps,
  p.duration_days
FROM users u
LEFT JOIN plans p ON u.plan_id = p.id;

-- 创建存储过程：支付成功后自动开通套餐
DELIMITER //
CREATE PROCEDURE sp_activate_plan(
  IN p_user_id INT,
  IN p_plan_id INT,
  IN p_order_id INT
)
BEGIN
  DECLARE v_duration INT;
  DECLARE v_expire_date DATE;
  
  -- 获取套餐天数
  SELECT duration_days INTO v_duration FROM plans WHERE id = p_plan_id;
  
  -- 计算到期时间
  SELECT CASE 
    WHEN plan_expire > CURDATE() THEN DATE_ADD(plan_expire, INTERVAL v_duration DAY)
    ELSE DATE_ADD(CURDATE(), INTERVAL v_duration DAY)
  END INTO v_expire_date
  FROM users WHERE id = p_user_id;
  
  -- 更新用户套餐
  UPDATE users SET 
    plan_id = p_plan_id,
    plan_expire = v_expire_date,
    data_used = 0,
    status = 'active'
  WHERE id = p_user_id;
  
  -- 更新订单状态
  UPDATE orders SET 
    status = 'completed',
    paid_at = NOW()
  WHERE id = p_order_id;
END //
DELIMITER ;

-- 创建事件：自动清理过期的验证码
DELIMITER //
CREATE EVENT IF NOT EXISTS cleanup_expired_codes
ON SCHEDULE EVERY 1 HOUR
DO
  DELETE FROM email_verification_codes 
  WHERE expires_at < NOW() OR is_used = TRUE;
//
DELIMITER ;

-- 启用事件调度器
SET GLOBAL event_scheduler = ON;

-- ============================================
-- 工单系统表
-- ============================================

-- 工单主表
CREATE TABLE IF NOT EXISTS tickets (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  ticket_no VARCHAR(20) NOT NULL UNIQUE,
  user_id INT UNSIGNED NOT NULL,
  username VARCHAR(50) NOT NULL,
  user_email VARCHAR(100) NOT NULL,
  subject VARCHAR(200) NOT NULL,
  category ENUM('technical', 'payment', 'account', 'refund', 'other') NOT NULL DEFAULT 'technical',
  priority ENUM('low', 'medium', 'high', 'urgent') NOT NULL DEFAULT 'medium',
  status ENUM('open', 'pending', 'resolved', 'closed') NOT NULL DEFAULT 'open',
  assigned_admin_id INT UNSIGNED,
  assigned_admin_name VARCHAR(50),
  plan_id INT UNSIGNED,
  plan_name VARCHAR(100),
  order_id INT UNSIGNED,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  closed_at DATETIME,
  closed_by VARCHAR(50),
  last_reply_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  unread_count INT UNSIGNED DEFAULT 0,
  message_count INT UNSIGNED DEFAULT 0,
  tags JSON,
  admin_notes TEXT,
  INDEX idx_user_id (user_id),
  INDEX idx_status (status),
  INDEX idx_category (category),
  INDEX idx_priority (priority),
  INDEX idx_assigned_admin_id (assigned_admin_id),
  INDEX idx_ticket_no (ticket_no),
  INDEX idx_last_reply_at (last_reply_at),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (assigned_admin_id) REFERENCES admins(id) ON DELETE SET NULL,
  FOREIGN KEY (plan_id) REFERENCES plans(id) ON DELETE SET NULL,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 工单消息表
CREATE TABLE IF NOT EXISTS ticket_messages (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  ticket_id INT UNSIGNED NOT NULL,
  sender_id INT UNSIGNED NOT NULL,
  sender_type ENUM('user', 'admin', 'system') NOT NULL,
  sender_name VARCHAR(100) NOT NULL,
  content TEXT NOT NULL,
  attachments JSON,
  is_read BOOLEAN DEFAULT FALSE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_ticket_id (ticket_id),
  INDEX idx_sender_id (sender_id),
  INDEX idx_sender_type (sender_type),
  INDEX idx_is_read (is_read),
  INDEX idx_created_at (created_at),
  FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 客服快捷回复表
CREATE TABLE IF NOT EXISTS quick_replies (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  admin_id INT UNSIGNED,
  title VARCHAR(100) NOT NULL,
  content TEXT NOT NULL,
  category VARCHAR(50) DEFAULT 'general',
  usage_count INT UNSIGNED DEFAULT 0,
  is_public BOOLEAN DEFAULT TRUE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_admin_id (admin_id),
  INDEX idx_category (category),
  FOREIGN KEY (admin_id) REFERENCES admins(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 插入默认快捷回复
INSERT INTO quick_replies (title, content, category, is_public) VALUES
('欢迎语', '您好！欢迎使用 RocketStore 服务，请问有什么可以帮您的？', 'general', TRUE),
('节点优化建议', '建议您尝试以下优化：\n1. 使用 Clash.Meta 客户端\n2. 选择延迟最低的节点\n3. 开启 UDP 和 TFO 选项\n4. 如仍有问题请提交工单', 'technical', TRUE),
('支付确认', '您的支付已收到，我们正在处理中，预计5-10分钟内完成开通。', 'payment', TRUE),
('退款说明', '我们支持购买后24小时内未使用的全额退款。请提供订单号，我们会尽快处理。', 'refund', TRUE),
('套餐续费提醒', '您的套餐即将到期，建议及时续费以免影响使用。续费后流量将重新计算。', 'account', TRUE);
