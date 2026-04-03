# RocketStore 部署文档

## 环境要求

- Node.js 18+
- MySQL 8.0+
- npm 或 yarn

## 数据库部署

### 1. 安装 MySQL 8.0

```bash
# Ubuntu/Debian
sudo apt update
sudo apt install mysql-server-8.0

# CentOS/RHEL
sudo yum install mysql-server

# 启动 MySQL
sudo systemctl start mysql
sudo systemctl enable mysql
```

### 2. 创建数据库和导入表结构

```bash
# 登录 MySQL
mysql -u root -p

# 执行建表脚本
mysql -u root -p < server/database/schema.sql
```

### 3. 创建专用数据库用户（推荐）

```sql
CREATE USER 'rocketstore'@'localhost' IDENTIFIED BY 'your_secure_password';
GRANT ALL PRIVILEGES ON rocketstore.* TO 'rocketstore'@'localhost';
FLUSH PRIVILEGES;
```

## 后端部署

### 1. 配置环境变量

```bash
cd server
cp .env.example .env
nano .env
```

编辑 `.env` 文件：

```env
# 服务器配置
PORT=3000
NODE_ENV=production

# 数据库配置
DB_HOST=localhost
DB_PORT=3306
DB_USER=rocketstore
DB_PASSWORD=your_secure_password
DB_NAME=rocketstore

# JWT 密钥（请修改为随机字符串）
JWT_SECRET=your-random-jwt-secret-key-here-change-in-production

# CORS 配置
CORS_ORIGIN=http://yourdomain.com
```

### 2. 安装依赖并启动

```bash
cd server
npm install

# 开发模式
npm run dev

# 生产模式
npm start
```

### 3. 使用 PM2 管理进程（推荐）

```bash
npm install -g pm2

cd server
pm2 start src/index.js --name rocketstore-api
pm2 save
pm2 startup
```

## 前端部署

### 1. 构建

```bash
npm install
npm run build
```

### 2. 使用 Nginx 部署

```nginx
server {
    listen 80;
    server_name yourdomain.com;

    # 前端静态文件
    location / {
        root /path/to/dist;
        try_files $uri $uri/ /index.html;
    }

    # 后端 API 代理
    location /api/ {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # 订阅接口
    location /sub/ {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
    }
}
```

### 3. HTTPS 配置（Let's Encrypt）

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d yourdomain.com
```

## 支付宝当面付配置

### 1. 注册支付宝开放平台

1. 访问 https://open.alipay.com
2. 注册并登录
3. 创建应用

### 2. 生成 RSA2 密钥

```bash
# 使用支付宝开放平台助手生成
# 或使用 OpenSSL
openssl genrsa -out app_private_key.pem 2048
openssl rsa -in app_private_key.pem -pubout -out app_public_key.pem
```

### 3. 配置应用

1. 在应用中上传应用公钥
2. 获取支付宝公钥
3. 开通"当面付"产品
4. 在管理后台填写配置信息

## USDT 支付配置

### 方案一：直接钱包收款

1. 在管理后台填写收款钱包地址
2. 选择网络（推荐 TRC20）
3. 设置 Webhook 通知地址

### 方案二：NOWPayments

1. 注册 https://nowpayments.io
2. 获取 API Key
3. 在管理后台填写 API 信息
4. 设置 Webhook 通知地址

## 邮件服务配置

### QQ 邮箱

```
SMTP 服务器: smtp.qq.com
端口: 465 (SSL) 或 587 (STARTTLS)
用户名: 你的QQ邮箱
密码: 授权码（非QQ密码）
```

### Gmail

```
SMTP 服务器: smtp.gmail.com
端口: 465 (SSL)
用户名: 你的Gmail地址
密码: 应用专用密码
```

## 安全建议

1. **修改默认管理员密码**
   - 登录后立即修改 admin/admin123

2. **使用 HTTPS**
   - 所有生产环境必须使用 HTTPS

3. **定期备份数据库**
   ```bash
   mysqldump -u root -p rocketstore > backup_$(date +%Y%m%d).sql
   ```

4. **防火墙配置**
   ```bash
   sudo ufw allow 80/tcp
   sudo ufw allow 443/tcp
   sudo ufw allow 3000/tcp  # 仅当需要直接访问后端时
   sudo ufw enable
   ```

5. **更新 JWT_SECRET**
   - 使用随机生成的密钥替换默认值

## 故障排查

### 数据库连接失败
```bash
# 检查 MySQL 是否运行
sudo systemctl status mysql

# 检查端口
sudo netstat -tlnp | grep 3306
```

### 后端启动失败
```bash
# 查看详细日志
cd server
NODE_ENV=development node src/index.js
```

### 前端白屏
```bash
# 检查构建
npm run build

# 检查 Nginx 配置
sudo nginx -t
sudo systemctl restart nginx
```

## 测试账号

- **管理员**: admin / admin123
- **用户**: testuser / test123
- **用户**: vipuser / vip123
