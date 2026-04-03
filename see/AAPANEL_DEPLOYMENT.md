# 🚀 aaPanel 部署超详细教程（零基础版）

> 本教程专为**完全零基础**的初学者编写，每一步都有详细说明。
> 
> **预计时间：** 40-90分钟 | **难度：** ⭐☆☆☆☆（跟着做就行）
> 
> **重要提示：** 请**严格按顺序**执行每一步，不要跳过任何步骤！

---

## 📋 完整目录

```
第1章：购买和准备服务器
  1.1 选择服务器提供商
  1.2 购买服务器（以阿里云为例）
  1.3 获取服务器IP和密码
  1.4 准备SSH连接工具

第2章：连接服务器
  2.1 Windows 用户使用 FinalShell 连接
  2.2 Mac 用户使用终端连接
  2.3 连接成功确认

第3章：安装 aaPanel 面板
  3.1 执行安装命令
  3.2 等待安装完成
  3.3 保存登录信息
  3.4 登录 aaPanel
  3.5 首次设置

第4章：安装运行环境
  4.1 安装 Node.js
  4.2 安装 MySQL 8.0
  4.3 安装 Nginx
  4.4 安装 PM2
  4.5 验证所有环境

第5章：上传项目文件
  5.1 准备项目文件
  5.2 创建网站目录
  5.3 上传前端源码
  5.4 上传后端源码
  5.5 验证文件完整性

第6章：配置数据库
  6.1 创建数据库
  6.2 导入数据库表结构
  6.3 创建数据库用户
  6.4 验证数据库

第7章：部署后端服务
  7.1 配置环境变量
  7.2 安装后端依赖
  7.3 测试后端启动
  7.4 使用 PM2 管理进程
  7.5 验证后端API

第8章：部署前端网站
  8.1 安装前端依赖
  8.2 构建前端
  8.3 在 aaPanel 添加网站
  8.4 配置 Nginx
  8.5 验证前端访问

第9章：配置域名和SSL
  9.1 域名解析
  9.2 申请SSL证书
  9.3 强制HTTPS
  9.4 验证HTTPS

第10章：完整测试
  10.1 功能测试清单
  10.2 API测试
  10.3 压力测试

第11章：常见问题排查
  11.1-11.15 详细问题解决方案

第12章：日常维护
  12.1 备份
  12.2 更新
  12.3 监控
  12.4 安全加固
```

---

## 第1章：购买和准备服务器

### 1.1 选择服务器提供商

根据你的用户群体选择服务器位置：

| 用户群体 | 推荐服务器 | 原因 |
|---------|-----------|------|
| 国内用户 | 阿里云/腾讯云 | 速度快，但需要备案 |
| 海外用户 | DigitalOcean/Vultr | 无需备案，价格便宜 |
| 全球用户 | AWS/Cloudflare | 全球CDN加速 |

**本教程以阿里云为例**，其他提供商操作类似。

### 1.2 购买服务器（以阿里云为例）

**详细步骤：**

1. 打开 [阿里云官网](https://www.aliyun.com/)
2. 点击右上角 **"免费注册"** 或 **"登录"**
3. 登录后，在顶部搜索框输入 **"ECS"**
4. 点击 **"云服务器ECS"**
5. 点击 **"立即购买"**

**选择配置（推荐）：**

```
计费方式：包年包月（长期使用更便宜）
地域：选择离你用户近的地区
实例规格：
  - 最低：ecs.t6-c1m1.large（1核2G，约 ¥50/月）
  - 推荐：ecs.c6.large（2核4G，约 ¥150/月）
操作系统：Ubuntu 22.04 64位
存储：40GB 高效云盘
网络：分配公网IP（必须选！）
带宽：按固定带宽，1-5Mbps
```

6. 设置 **登录密码**（务必记住！）
7. 点击 **"立即购买"** 并完成支付

### 1.3 获取服务器IP和密码

购买完成后：

1. 登录阿里云控制台
2. 进入 **"云服务器ECS"** → **"实例"**
3. 找到你的服务器，记录以下信息：
   - **公网IP地址**：例如 `47.100.123.456`
   - **登录用户名**：`root`
   - **登录密码**：你购买时设置的密码

### 1.4 开放安全组端口（重要！）

**这一步不做，后面所有功能都无法访问！**

1. 在ECS实例列表中，点击你的服务器ID
2. 点击左侧 **"安全组"**
3. 点击安全组ID进入配置
4. 点击 **"手动添加"** 规则，添加以下端口：

| 端口范围 | 协议 | 用途 | 授权对象 |
|---------|------|------|---------|
| 80/80 | TCP | HTTP | 0.0.0.0/0 |
| 443/443 | TCP | HTTPS | 0.0.0.0/0 |
| 3000/3000 | TCP | 后端API | 0.0.0.0/0 |
| 8888/8888 | TCP | aaPanel面板 | 0.0.0.0/0 |
| 22/22 | TCP | SSH连接 | 0.0.0.0/0 |
| 3306/3306 | TCP | MySQL（仅内网） | 172.16.0.0/12 |

5. 点击 **"保存"**

---

## 第2章：连接服务器

### 2.1 Windows 用户使用 FinalShell 连接（推荐）

**FinalShell 是一款免费的SSH客户端，比PuTTY更好用。**

**下载安装：**
1. 打开浏览器，访问 [FinalShell官网](http://www.hostbuf.com/)
2. 点击 **"下载"** → 选择 **"Windows版"**
3. 下载完成后双击安装，一直点"下一步"即可

**连接服务器：**
1. 打开 FinalShell
2. 点击左上角 **文件夹图标**（连接管理器）
3. 点击 **"SSH连接(Linux)"**
4. 填写以下信息：

```
名称：我的服务器（随便填）
主机：你的服务器公网IP（例如 47.100.123.456）
端口：22
用户名：root
密码：你购买服务器时设置的密码
```

5. 点击 **"连接"**
6. 首次连接会提示"接受并保存密钥"，点击 **"是"**

### 2.2 Mac 用户使用终端连接

1. 打开 **"终端"**（按 `Cmd + 空格`，搜索"终端"）
2. 输入以下命令：

```bash
ssh root@你的服务器IP
# 例如：ssh root@47.100.123.456
```

3. 首次连接会提示 `Are you sure you want to continue connecting (yes/no)?`
4. 输入 `yes` 然后按回车
5. 输入密码（输入时不会显示任何字符，这是正常的）
6. 按回车

### 2.3 连接成功确认

连接成功后，你会看到类似这样的提示：

```
Welcome to Ubuntu 22.04 LTS
...
root@your-server:~#
```

看到 `root@` 开头的提示符，说明连接成功！✅

---

## 第3章：安装 aaPanel 面板

### 3.1 执行安装命令

在SSH终端中，**复制以下整行命令并粘贴**（右键粘贴或按 Shift+Insert）：

```bash
wget -O install.sh http://www.aapanel.com/script/install-ubuntu_6.0_en.sh && sudo bash install.sh aapanel
```

### 3.2 等待安装完成

执行命令后：

1. 会提示：`Do you want to install aaPanel to the /www directory now?(y/n):`
2. 输入 `y` 然后按 **回车**
3. 开始安装，这个过程需要 **5-15分钟**，请耐心等待
4. 安装过程中会显示进度条和安装信息，**不要关闭终端窗口**

### 3.3 保存登录信息（非常重要！）

安装完成后，终端会显示类似以下信息：

```
==================================================================
Congratulations! Installed successfully!
==================================================================
aaPanel Internet Address: http://47.100.123.456:8888/a1b2c3d4
aaPanel Internal Address: http://172.16.0.1:8888/a1b2c3d4
username: abc12345
password: def67890
Warning:
If you cannot access the panel,
release the following port (8888|888|80|443|20|21) in the security group
==================================================================
```

**请立即截图或复制保存以下信息：**
- ✅ 外网地址（Internet Address）
- ✅ 用户名（username）
- ✅ 密码（password）
- ✅ 安全路径（URL中的 `/a1b2c3d4` 部分）

> ⚠️ **注意：** 这个安全路径是随机生成的，每次安装都不同！

### 3.4 登录 aaPanel

1. 打开浏览器（Chrome/Edge/Firefox 均可）
2. 在地址栏输入上面显示的 **外网地址**
3. 例如：`http://47.100.123.456:8888/a1b2c3d4`
4. 按回车
5. 输入用户名和密码
6. 点击 **"Login"**

### 3.5 首次设置

首次登录后：

1. **注册提示：** 可能会提示注册 aaPanel 账号，点击 **"Skip"** 跳过即可
2. **软件推荐：** 会弹出推荐安装软件的界面
   - **全部取消勾选！** 我们后面手动安装
   - 点击 **"Install"** 或 **"Close"**
3. **修改面板密码（推荐）：**
   - 点击左下角 **"Profile"** 图标
   - 修改用户名和密码（建议改为容易记住的）
   - 点击 **"Submit"**

---

## 第4章：安装运行环境

### 4.1 安装 Node.js（通过命令行，最可靠）

在SSH终端中执行以下命令：

```bash
# 第一步：添加 Node.js 18.x 源
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -

# 第二步：安装 Node.js
sudo apt-get install -y nodejs

# 第三步：验证安装
node -v
npm -v
```

**预期输出：**
```
v18.20.x
10.x.x
```

> 💡 如果 `node -v` 显示的不是 v18.x，请检查安装过程是否有报错。

### 4.2 安装 MySQL 8.0（通过 aaPanel 图形界面）

1. 在 aaPanel 左侧菜单点击 **"App Store"**
2. 在搜索框输入 `MySQL`
3. 找到 **"MySQL"**（不是 MariaDB）
4. 点击右侧的 **"Install"** 按钮
5. 在弹出的版本选择中，选择 **"MySQL 8.0"**
6. 点击 **"Submit"**
7. 等待安装完成（大约 5-10 分钟，可以在 "Task" 中查看进度）

**设置 MySQL root 密码：**
1. 安装完成后，点击左侧菜单 **"Databases"**
2. 点击顶部的 **"Root password"** 按钮
3. 在弹出的窗口中：
   - 输入新密码（例如：`MyRoot@2024!Secure`）
   - 再次确认密码
4. 点击 **"Submit"**
5. **务必记住这个密码！**

### 4.3 安装 Nginx（通过 aaPanel 图形界面）

1. 在 aaPanel 左侧菜单点击 **"App Store"**
2. 搜索 `Nginx`
3. 找到 **"Nginx"**
4. 点击 **"Install"**
5. 选择版本 **1.24** 或更高
6. 点击 **"Submit"**
7. 等待安装完成

### 4.4 安装 PM2（进程管理器）

在SSH终端中执行：

```bash
# 全局安装 PM2
npm install -g pm2

# 验证安装
pm2 -v
```

**预期输出：** `5.x.x`

### 4.5 验证所有环境

在SSH终端中执行以下命令，确保所有环境都安装成功：

```bash
echo "=== 环境检查 ==="
echo "Node.js: $(node -v)"
echo "npm: $(npm -v)"
echo "MySQL: $(mysql -V)"
echo "Nginx: $(nginx -v 2>&1)"
echo "PM2: $(pm2 -v)"
echo "=== 检查完成 ==="
```

**预期输出示例：**
```
=== 环境检查 ===
Node.js: v18.20.5
npm: 10.8.2
MySQL: mysql  Ver 8.0.36 for Linux on x86_64
Nginx: nginx version: nginx/1.24.0
PM2: 5.4.2
=== 检查完成 ===
```

如果所有版本都显示出来了，说明环境安装成功！✅

---

## 第5章：上传项目文件

### 5.1 准备项目文件

在你的**本地电脑**上：

1. 找到你的项目文件夹
2. 确认包含以下文件/目录：
   ```
   你的项目/
   ├── src/              # 前端源码
   ├── server/           # 后端源码
   ├── package.json      # 前端依赖
   ├── vite.config.ts    # Vite配置
   ├── index.html        # 入口HTML
   └── ...其他文件
   ```

### 5.2 创建网站目录

在SSH终端中执行：

```bash
# 创建前端目录
mkdir -p /www/wwwroot/rocketstore

# 创建后端目录
mkdir -p /www/wwwroot/rocketstore-server

# 验证目录创建成功
ls -la /www/wwwroot/
```

### 5.3 上传前端源码

**方法一：使用 FinalShell 的文件传输功能（最简单）**

1. 在 FinalShell 中，左侧会显示本地文件，右侧显示服务器文件
2. 在右侧导航到 `/www/wwwroot/rocketstore`
3. 在左侧找到你的项目文件夹
4. **全选所有文件**（Ctrl+A 或 Cmd+A）
5. **拖拽**到右侧的 `/www/wwwroot/rocketstore` 目录
6. 等待上传完成

**方法二：使用 aaPanel 文件管理器**

1. 在 aaPanel 左侧点击 **"Files"**
2. 导航到 `/www/wwwroot/rocketstore`
3. 点击顶部 **"Upload"** 按钮
4. 选择你的所有项目文件
5. 等待上传完成

**方法三：使用 SFTP 客户端（FileZilla）**

1. 下载并安装 [FileZilla](https://filezilla-project.org/)
2. 连接信息：
   ```
   主机：sftp://你的服务器IP
   用户名：root
   密码：你的服务器密码
   端口：22
   ```
3. 左侧选择本地项目文件
4. 右侧导航到 `/www/wwwroot/rocketstore`
5. 拖拽上传

### 5.4 上传后端源码

同样使用上述方法，将 `server/` 目录下的所有文件上传到：

```
/www/wwwroot/rocketstore-server/
```

**确保后端目录结构如下：**

```
/www/wwwroot/rocketstore-server/
├── src/
│   ├── index.js
│   ├── config/
│   │   └── database.js
│   ├── middleware/
│   │   └── auth.js
│   ├── routes/
│   │   ├── auth.js
│   │   ├── user.js
│   │   ├── admin.js
│   │   ├── payment.js
│   │   ├── email.js
│   │   ├── subscription.js
│   │   ├── subscribe.js
│   │   └── tickets.js
│   └── services/
│       ├── email.js
│       └── subscriptionParser.js
├── database/
│   └── schema.sql
└── package.json
```

### 5.5 验证文件完整性

在SSH终端中执行：

```bash
# 检查前端文件
echo "=== 前端文件 ==="
ls /www/wwwroot/rocketstore/
echo ""

# 检查后端文件
echo "=== 后端文件 ==="
ls /www/wwwroot/rocketstore-server/
echo ""

# 检查后端源码
echo "=== 后端源码 ==="
ls /www/wwwroot/rocketstore-server/src/
ls /www/wwwroot/rocketstore-server/src/routes/
```

确认所有文件都存在后，继续下一步。

---

## 第6章：配置数据库

### 6.1 创建数据库（通过 aaPanel 图形界面）

1. 在 aaPanel 左侧点击 **"Databases"**
2. 点击 **"Add database"** 按钮
3. 填写以下信息：

```
Database name: rocketstore
Username: rocketstore_user
Password: 点击"Generate"生成一个强密码（务必复制保存！）
Access permissions: Localhost（仅本地访问，更安全）
```

4. 点击 **"Submit"**
5. 数据库创建成功！

### 6.2 导入数据库表结构

**方法一：通过 aaPanel（推荐）**

1. 在 **"Databases"** 页面
2. 找到 `rocketstore` 数据库
3. 点击右侧的 **"Import"** 按钮
4. 在弹出的窗口中：
   - 点击 **"Select file"**
   - 浏览并选择你上传的 `schema.sql` 文件
   - 文件路径：`/www/wwwroot/rocketstore-server/database/schema.sql`
5. 点击 **"Submit"**
6. 等待导入完成

**方法二：通过命令行**

```bash
# 导入数据库
mysql -u root -p rocketstore < /www/wwwroot/rocketstore-server/database/schema.sql
# 输入你的 MySQL root 密码
```

### 6.3 设置数据库用户权限

在SSH终端中执行：

```bash
# 登录 MySQL
mysql -u root -p
# 输入你的 MySQL root 密码
```

然后在 MySQL 命令行中执行：

```sql
-- 创建数据库用户（如果还没创建）
CREATE USER IF NOT EXISTS 'rocketstore_user'@'localhost' IDENTIFIED BY '你的数据库密码';

-- 授予权限
GRANT ALL PRIVILEGES ON rocketstore.* TO 'rocketstore_user'@'localhost';

-- 刷新权限
FLUSH PRIVILEGES;

-- 退出
EXIT;
```

### 6.4 验证数据库

```bash
# 登录数据库
mysql -u rocketstore_user -p rocketstore
# 输入数据库用户密码

# 查看所有表
SHOW TABLES;

# 应该看到以下表：
-- admins
-- users
-- plans
-- subscriptions
-- nodes
-- plan_nodes
-- orders
-- recharges
-- email_verification_codes
-- system_configs
-- audit_logs
-- tickets
-- ticket_messages
-- vouchers
-- invitations

# 退出
EXIT;
```

如果所有表都显示出来了，数据库配置成功！✅

---

## 第7章：部署后端服务

### 7.1 配置环境变量（.env 文件）

在SSH终端中执行：

```bash
# 进入后端目录
cd /www/wwwroot/rocketstore-server

# 创建 .env 文件
nano .env
```

复制以下所有内容，然后**右键粘贴**到终端中：

```env
# ============ 服务器配置 ============
PORT=3000
NODE_ENV=production

# ============ 数据库配置 ============
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=rocketstore_user
DB_PASSWORD=你的数据库密码
DB_NAME=rocketstore

# ============ JWT 密钥 ============
# 生成随机密钥的命令：node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
JWT_SECRET=

# ============ CORS 配置 ============
# 前端域名，多个用逗号分隔
CORS_ORIGIN=http://你的域名,https://你的域名

# ============ 支付宝配置 ============
ALIPAY_APP_ID=
ALIPAY_PRIVATE_KEY=
ALIPAY_PUBLIC_KEY=
ALIPAY_NOTIFY_URL=https://你的域名/api/payment/alipay-notify

# ============ USDT 支付配置 ============
USDT_NETWORK=TRC20
USDT_WALLET_ADDRESS=
USDT_API_KEY=
USDT_NOTIFY_URL=https://你的域名/api/payment/usdt-notify

# ============ 邮件配置 ============
SMTP_HOST=smtp.qq.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=
SMTP_PASS=
SMTP_FROM_NAME=RocketStore

# ============ 订阅解析 ============
SUBSCRIPTION_BASE_URL=https://你的域名/sub
```

**修改以下内容：**
1. `DB_PASSWORD` → 你在 6.1 中设置的数据库密码
2. `JWT_SECRET` → 运行以下命令生成：
   ```bash
   node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
   ```
   将生成的长字符串填入
3. `CORS_ORIGIN` → 你的域名（如果没有域名，先填 `http://你的服务器IP`）
4. `SUBSCRIPTION_BASE_URL` → 你的域名

**保存并退出：**
- 按 `Ctrl + O`（字母O）保存
- 按 `Enter` 确认文件名
- 按 `Ctrl + X` 退出

### 7.2 安装后端依赖

```bash
cd /www/wwwroot/rocketstore-server

# 安装所有依赖
npm install

# 如果安装很慢，可以使用淘宝镜像
# npm install --registry=https://registry.npmmirror.com
```

等待安装完成（大约 1-3 分钟）。

### 7.3 测试后端启动

```bash
cd /www/wwwroot/rocketstore-server

# 测试运行
node src/index.js
```

**如果看到以下输出，说明启动成功：**

```
🚀 RocketStore Server running on port 3000
✅ Database connected successfully
```

**如果出现错误：**
- `EADDRINUSE`：端口被占用，执行 `lsof -i :3000` 查看并 `kill` 占用进程
- `ER_ACCESS_DENIED_ERROR`：数据库密码错误，检查 .env 文件
- `Cannot find module`：依赖未安装，重新执行 `npm install`

测试成功后，按 `Ctrl + C` 停止服务。

### 7.4 使用 PM2 管理后端进程

```bash
cd /www/wwwroot/rocketstore-server

# 启动后端服务
pm2 start src/index.js --name rocketstore-api

# 保存进程列表（开机自启）
pm2 save

# 设置开机自启
pm2 startup

# 查看运行状态
pm2 status

# 查看实时日志
pm2 logs rocketstore-api
```

**PM2 常用命令：**

```bash
pm2 list                    # 查看所有进程
pm2 logs rocketstore-api    # 查看日志
pm2 restart rocketstore-api # 重启服务
pm2 stop rocketstore-api    # 停止服务
pm2 delete rocketstore-api  # 删除进程
pm2 monit                   # 实时监控（CPU、内存）
```

### 7.5 验证后端API

```bash
# 测试健康检查
curl http://127.0.0.1:3000/api/health

# 预期输出：
# {"success":true,"message":"Server is running","timestamp":"..."}
```

如果返回了 JSON 数据，后端部署成功！✅

---

## 第8章：部署前端网站

### 8.1 安装前端依赖

```bash
cd /www/wwwroot/rocketstore

# 安装所有依赖
npm install

# 如果安装很慢
# npm install --registry=https://registry.npmmirror.com
```

### 8.2 构建前端

```bash
cd /www/wwwroot/rocketstore

# 构建生产版本
npm run build
```

构建完成后，会生成 `dist/` 目录：

```bash
# 验证构建结果
ls -la /www/wwwroot/rocketstore/dist/
```

应该看到：
```
index.html
assets/
  ├── index-xxxxx.css
  ├── index-xxxxx.js
  └── ...其他静态文件
```

### 8.3 在 aaPanel 添加网站

1. 在 aaPanel 左侧点击 **"Website"**
2. 点击 **"Add site"**
3. 填写以下信息：

```
Domain: 你的域名 或 服务器IP
  （例如：www.example.com 或 47.100.123.456）
  
Root directory: 
  点击文件夹图标，选择 /www/wwwroot/rocketstore/dist
  
PHP version: Pure Static（纯静态）

Database: Don't create（前端不需要数据库）

FTP: Don't create
```

4. 点击 **"Submit"**

### 8.4 配置 Nginx

1. 在 **"Website"** 页面，找到你刚创建的网站
2. 点击右侧的 **"Conf"** 按钮
3. 在配置编辑器中，找到 `location /` 部分
4. 将其修改为以下内容：

```nginx
server {
    listen 80;
    server_name 你的域名或IP;
    root /www/wwwroot/rocketstore/dist;
    index index.html;

    # 前端 SPA 路由支持（重要！）
    location / {
        try_files $uri $uri/ /index.html;
    }

    # 后端 API 反向代理
    location /api/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # 订阅链接代理
    location /sub/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        add_header Cache-Control "no-cache, no-store, must-revalidate";
        add_header Pragma "no-cache";
        add_header Expires "0";
    }

    # 静态文件缓存
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # 安全头
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # 日志
    access_log /www/wwwlogs/rocketstore-access.log;
    error_log /www/wwwlogs/rocketstore-error.log;
}
```

5. 点击 **"Save"** 保存
6. 点击 **"Reload"** 重载配置（或重启 Nginx 服务）

### 8.5 验证前端访问

打开浏览器，访问：

```
http://你的服务器IP
或
http://你的域名
```

应该能看到网站主页！✅

如果看到页面但样式混乱，按 `Ctrl + F5` 强制刷新浏览器缓存。

---

## 第9章：配置域名和SSL

### 9.1 域名解析

在你的域名注册商处添加 DNS 记录：

**以阿里云为例：**
1. 登录 [阿里云控制台](https://dns.console.aliyun.com/)
2. 进入 **"域名"** → **"DNS 解析"**
3. 找到你的域名，点击 **"解析设置"**
4. 点击 **"添加记录"**，添加两条记录：

```
记录1：
  记录类型：A
  主机记录：@
  记录值：你的服务器IP
  TTL：600秒

记录2：
  记录类型：A
  主机记录：www
  记录值：你的服务器IP
  TTL：600秒
```

**以 Cloudflare 为例：**
1. 登录 Cloudflare
2. 选择你的域名
3. 点击 **"DNS"**
4. 添加 A 记录：
   ```
   Type: A
   Name: @
   Content: 你的服务器IP
   Proxy status: Proxied（橙色云朵）
   ```

### 9.2 等待 DNS 生效

DNS 生效通常需要 **10分钟到24小时**。

检查方法：
```bash
# 在本地电脑终端执行
ping 你的域名
# 如果返回的是你的服务器IP，说明DNS已生效
```

### 9.3 申请 SSL 证书（免费 HTTPS）

**通过 aaPanel（最简单）：**

1. 在 aaPanel 左侧点击 **"Website"**
2. 找到你的网站，点击 **"Conf"**
3. 点击 **"SSL"** 标签页
4. 选择 **"Let's Encrypt"**
5. 勾选你的域名（如果有的话）
6. 填写邮箱地址
7. 点击 **"Apply"**
8. 等待 1-2 分钟，证书签发成功
9. 开启 **"Force HTTPS"** 开关

**通过命令行（如果 aaPanel 失败）：**

```bash
# 安装 Certbot
sudo apt update
sudo apt install -y certbot python3-certbot-nginx

# 申请证书
sudo certbot --nginx -d 你的域名 -d www.你的域名

# 按提示操作：
# 1. 输入邮箱地址
# 2. 同意服务条款（输入 A）
# 3. 是否分享邮箱（输入 Y 或 N）
# 4. 选择是否强制 HTTPS（输入 2 - Redirect）
```

### 9.4 验证 HTTPS

打开浏览器访问：

```
https://你的域名
```

应该能看到：
- ✅ 地址栏有锁图标
- ✅ 显示 "连接是安全的"
- ✅ 网站正常显示

---

## 第10章：完整测试

### 10.1 功能测试清单

| 序号 | 功能 | 测试方法 | 预期结果 |
|------|------|---------|---------|
| 1 | 前端页面 | 浏览器访问域名 | 正常显示首页 |
| 2 | 用户注册 | 填写注册表单 | 注册成功，可登录 |
| 3 | 用户登录 | 使用账号登录 | 登录成功，进入用户面板 |
| 4 | 管理员登录 | admin/admin123 | 登录成功，进入管理后台 |
| 5 | 查看套餐 | 首页浏览套餐 | 显示套餐列表 |
| 6 | 购买套餐 | 选择套餐支付 | 订单创建成功 |
| 7 | 订阅链接 | 复制订阅链接 | 可导入 Clash/V2Ray |
| 8 | 节点延迟 | 点击延迟测试 | 显示延迟数值 |
| 9 | 工单系统 | 提交工单 | 工单创建成功 |
| 10 | 邀请系统 | 使用邀请码注册 | 邀请关系建立 |
| 11 | 邮箱验证 | 注册时输入邮箱 | 收到验证码（如已配置SMTP） |
| 12 | 忘记密码 | 点击忘记密码 | 可通过邮箱重置 |
| 13 | 节点管理 | 管理后台操作 | 节点正常显示和管理 |
| 14 | 支付配置 | 管理后台配置 | 支付宝/USDT配置保存 |

### 10.2 API 测试

```bash
# 测试健康检查
curl https://你的域名/api/health

# 测试用户注册
curl -X POST https://你的域名/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"testuser","email":"test@example.com","password":"test123"}'

# 测试用户登录
curl -X POST https://你的域名/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"testuser","password":"test123"}'

# 测试管理员登录
curl -X POST https://你的域名/api/auth/admin-login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'
```

### 10.3 压力测试（可选）

```bash
# 安装 ab 工具
sudo apt install -y apache2-utils

# 测试前端静态文件
ab -n 1000 -c 10 https://你的域名/

# 测试 API
ab -n 100 -c 5 https://你的域名/api/health
```

---

## 第11章：常见问题排查

### 11.1 网站无法访问（白屏/连接超时）

**排查步骤：**

```bash
# 1. 检查服务器是否在线
ping 你的服务器IP

# 2. 检查 Nginx 是否运行
systemctl status nginx
# 如果没有运行，启动它：
sudo systemctl start nginx

# 3. 检查端口是否监听
sudo netstat -tlnp | grep 80
sudo netstat -tlnp | grep 443

# 4. 检查防火墙
sudo ufw status
# 如果防火墙开启，放行端口：
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# 5. 检查云服务商安全组
# 登录阿里云/腾讯云控制台，确认安全组已开放 80 和 443 端口

# 6. 查看 Nginx 错误日志
tail -50 /www/wwwlogs/rocketstore-error.log
```

### 11.2 后端 API 返回 502 Bad Gateway

```bash
# 1. 检查 PM2 进程是否运行
pm2 status

# 2. 查看后端日志
pm2 logs rocketstore-api --lines 50

# 3. 检查后端端口是否监听
sudo netstat -tlnp | grep 3000

# 4. 测试本地访问
curl http://127.0.0.1:3000/api/health

# 5. 如果后端没运行，重启：
pm2 restart rocketstore-api

# 6. 检查 .env 配置
cat /www/wwwroot/rocketstore-server/.env
```

### 11.3 数据库连接失败

```bash
# 1. 检查 MySQL 是否运行
systemctl status mysql

# 2. 测试数据库连接
mysql -u rocketstore_user -p rocketstore
# 输入密码，如果能登录说明连接正常

# 3. 检查 .env 中的数据库配置
cat /www/wwwroot/rocketstore-server/.env | grep DB_

# 4. 查看后端错误日志
pm2 logs rocketstore-api --err --lines 50
```

### 11.4 前端页面空白

```bash
# 1. 检查构建文件是否存在
ls -la /www/wwwroot/rocketstore/dist/

# 2. 检查 Nginx root 路径
cat /www/server/panel/vhost/nginx/你的域名.conf | grep root

# 3. 重新构建前端
cd /www/wwwroot/rocketstore
npm run build

# 4. 检查浏览器控制台（按 F12）
# 查看 Console 和 Network 标签是否有错误

# 5. 清除浏览器缓存（Ctrl + Shift + Delete）
```

### 11.5 注册/登录失败

```bash
# 1. 检查后端日志
pm2 logs rocketstore-api --lines 20

# 2. 检查数据库是否有 users 表
mysql -u rocketstore_user -p rocketstore -e "DESCRIBE users;"

# 3. 检查 CORS 配置
cat /www/wwwroot/rocketstore-server/.env | grep CORS

# 4. 测试 API 直接调用
curl -X POST http://127.0.0.1:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'
```

### 11.6 订阅链接无法使用

```bash
# 1. 测试订阅链接
curl -I https://你的域名/sub/用户令牌

# 2. 检查 Nginx 订阅代理配置
cat /www/server/panel/vhost/nginx/你的域名.conf | grep -A 10 "location /sub/"

# 3. 检查后端日志
pm2 logs rocketstore-api --lines 20 | grep sub

# 4. 检查用户订阅令牌
mysql -u rocketstore_user -p rocketstore -e "SELECT id, username, subscription_token FROM users LIMIT 5;"
```

### 11.7 PM2 进程意外退出

```bash
# 1. 查看退出原因
pm2 logs rocketstore-api --err --lines 50

# 2. 检查内存使用
free -h
pm2 monit

# 3. 增加内存限制重启
pm2 restart rocketstore-api --node-args="--max-old-space-size=1024"

# 4. 设置内存限制自动重启
pm2 delete rocketstore-api
pm2 start src/index.js --name rocketstore-api --max-memory-restart 500M
```

### 11.8 SSL 证书问题

```bash
# 1. 检查证书是否有效
openssl s_client -connect 你的域名:443 -servername 你的域名 < /dev/null 2>/dev/null | openssl x509 -noout -dates

# 2. 手动续期证书
sudo certbot renew

# 3. 通过 aaPanel 重新申请
# Website → 你的网站 → Conf → SSL → Let's Encrypt → Apply
```

### 11.9 邮件发送失败

```bash
# 1. 检查 SMTP 配置
cat /www/wwwroot/rocketstore-server/.env | grep SMTP_

# 2. QQ邮箱需要开启 SMTP 服务并使用授权码
# 登录 QQ邮箱 → 设置 → 账户 → POP3/SMTP服务 → 开启 → 生成授权码

# 3. Gmail 需要应用专用密码
# Google 账号 → 安全 → 应用专用密码 → 生成

# 4. 测试 SMTP 连接
# 在管理后台的"邮件配置"中点击"发送测试邮件"
```

### 11.10 支付回调失败

```bash
# 1. 检查回调 URL 是否可访问
curl https://你的域名/api/payment/alipay-notify
curl https://你的域名/api/payment/usdt-notify

# 2. 确保回调 URL 使用 HTTPS
# 支付宝和 USDT 回调必须使用 HTTPS

# 3. 检查支付配置
cat /www/wwwroot/rocketstore-server/.env | grep -E "ALIPAY|USDT"

# 4. 查看支付日志
pm2 logs rocketstore-api --lines 50 | grep -i payment
```

### 11.11 端口被占用

```bash
# 查找占用端口的进程
sudo lsof -i :3000
sudo lsof -i :80
sudo lsof -i :443

# 杀掉占用进程
sudo kill -9 进程ID
```

### 11.12 磁盘空间不足

```bash
# 检查磁盘使用
df -h

# 清理 npm 缓存
npm cache clean --force

# 清理 PM2 日志
pm2 flush

# 清理旧日志
sudo rm -rf /www/wwwlogs/*.log.*
sudo find /www/wwwlogs/ -name "*.log" -mtime +7 -delete

# 清理 apt 缓存
sudo apt clean
```

### 11.13 文件权限问题

```bash
# 设置正确的文件权限
sudo chown -R www:www /www/wwwroot/rocketstore
sudo chown -R www:www /www/wwwroot/rocketstore-server
sudo chmod -R 755 /www/wwwroot/

# 设置 .env 文件权限（仅 owner 可读写）
chmod 600 /www/wwwroot/rocketstore-server/.env
```

### 11.14 Nginx 配置错误

```bash
# 测试 Nginx 配置
sudo nginx -t

# 如果报错，查看具体错误信息
# 常见错误：
# - "unknown directive"：配置语法错误
# - "host not found"：server_name 域名无法解析
# - "no such file"：root 路径不存在

# 修复后重载
sudo nginx -s reload
```

### 11.15 MySQL 启动失败

```bash
# 查看 MySQL 状态
systemctl status mysql

# 查看错误日志
sudo tail -50 /var/log/mysql/error.log

# 常见原因：
# 1. 磁盘空间不足：df -h
# 2. 配置文件错误：检查 /etc/mysql/mysql.conf.d/mysqld.cnf
# 3. 内存不足：free -h

# 重启 MySQL
sudo systemctl restart mysql
```

---

## 第12章：日常维护

### 12.1 数据库备份

**手动备份：**
```bash
# 备份整个数据库
mysqldump -u rocketstore_user -p rocketstore > /www/backup/rocketstore_$(date +%Y%m%d).sql

# 备份到本地电脑
scp root@你的服务器IP:/www/backup/rocketstore_*.sql ./
```

**自动备份（使用 aaPanel）：**
1. 在 aaPanel 左侧点击 **"Cron"**（计划任务）
2. 点击 **"Add task"**
3. 设置：
   ```
   Task type: Backup database
   Task name: 每日数据库备份
   Execution cycle: Daily
   Hour: 3
   Minute: 0
   Database: rocketstore
   Backup to: Local disk
   Retain: 7（保留7天）
   ```
4. 点击 **"Add task"**

### 12.2 文件备份

```bash
# 备份前端
tar -czf /www/backup/frontend_$(date +%Y%m%d).tar.gz /www/wwwroot/rocketstore/dist/

# 备份后端
tar -czf /www/backup/backend_$(date +%Y%m%d).tar.gz /www/wwwroot/rocketstore-server/

# 备份 .env 文件（重要！）
cp /www/wwwroot/rocketstore-server/.env /www/backup/.env_$(date +%Y%m%d).bak
```

### 12.3 更新项目

**更新前端：**
```bash
cd /www/wwwroot/rocketstore

# 拉取最新代码（如果使用 Git）
git pull

# 或上传新文件

# 重新安装依赖
npm install

# 重新构建
npm run build

# 清除 Nginx 缓存
sudo nginx -s reload
```

**更新后端：**
```bash
cd /www/wwwroot/rocketstore-server

# 拉取最新代码或上传新文件

# 安装新依赖
npm install

# 重启服务
pm2 restart rocketstore-api
```

### 12.4 监控和日志

**查看系统资源：**
```bash
# CPU 和内存
htop

# 磁盘使用
df -h

# 网络流量
iftop
```

**查看日志：**
```bash
# 后端日志
pm2 logs rocketstore-api

# Nginx 访问日志
tail -f /www/wwwlogs/rocketstore-access.log

# Nginx 错误日志
tail -f /www/wwwlogs/rocketstore-error.log

# MySQL 日志
sudo tail -f /var/log/mysql/error.log
```

### 12.5 安全加固

**1. 修改默认密码：**
```bash
# 修改管理员密码（在管理后台操作）
# 修改 aaPanel 密码（在 aaPanel Profile 中修改）
# 修改 MySQL root 密码
mysql -u root -p -e "ALTER USER 'root'@'localhost' IDENTIFIED BY '新密码';"
```

**2. 配置防火墙：**
```bash
# 启用 UFW 防火墙
sudo ufw enable

# 只开放必要端口
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw allow 8888/tcp

# 查看状态
sudo ufw status
```

**3. 禁用 root SSH 密码登录（可选，高级）：**
```bash
# 编辑 SSH 配置
sudo nano /etc/ssh/sshd_config

# 修改以下行：
# PermitRootLogin prohibit-password
# PasswordAuthentication no

# 重启 SSH 服务
sudo systemctl restart sshd
```

**4. 安装 Fail2Ban（防止暴力破解）：**
```bash
sudo apt install -y fail2ban
sudo systemctl enable fail2ban
sudo systemctl start fail2ban
```

**5. 定期更新系统：**
```bash
sudo apt update && sudo apt upgrade -y
```

---

## 🎯 部署完成检查清单

部署完成后，请逐项检查：

- [ ] 服务器已购买并配置安全组
- [ ] SSH 连接成功
- [ ] aaPanel 安装成功并可登录
- [ ] Node.js v18+ 已安装
- [ ] MySQL 8.0 已安装
- [ ] Nginx 已安装
- [ ] PM2 已安装
- [ ] 前端文件已上传
- [ ] 后端文件已上传
- [ ] 数据库已创建并导入表结构
- [ ] .env 配置文件已创建
- [ ] 后端依赖已安装
- [ ] 后端服务已启动（PM2）
- [ ] 前端已构建
- [ ] 网站已在 aaPanel 中添加
- [ ] Nginx 配置已更新
- [ ] 前端页面可正常访问
- [ ] 后端 API 可正常调用
- [ ] 用户注册/登录功能正常
- [ ] 管理员登录功能正常
- [ ] 域名已解析（如有）
- [ ] SSL 证书已配置（如有）
- [ ] HTTPS 访问正常（如有）
- [ ] 数据库备份已配置
- [ ] 防火墙已配置

---

## 🔒 安全建议

1. **修改默认密码** - 管理员默认密码 `admin/admin123` 必须修改
2. **修改 aaPanel 端口** - 在 aaPanel 面板设置中修改默认 8888 端口
3. **启用防火墙** - 只开放必要的端口
4. **定期备份** - 每天自动备份数据库
5. **更新软件** - 定期更新系统软件
6. **监控日志** - 定期检查访问日志和错误日志
7. **使用 HTTPS** - 强制所有流量使用 HTTPS
8. **保护 .env 文件** - 设置权限为 600
9. **限制 API 访问** - 后端已内置 rate-limit
10. **定期更换密码** - 每 3 个月更换一次重要密码

---

**祝你部署顺利！🚀**

如果遇到问题，请查看第11章的常见问题排查部分。
