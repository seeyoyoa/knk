// 数据类型定义

export interface Node {
  id: string;
  name: string;
  type: 'ss' | 'ssr' | 'vmess' | 'vless' | 'trojan' | 'hysteria' | 'hysteria2' | 'tuic' | 'wireguard' | 'snell' | 'ssh' | 'http' | 'socks5' | 'direct';
  server: string;
  port: number;
  uuid?: string;
  alterId?: number;
  protocol?: string;
  network?: string;
  tls?: boolean;
  nodeId?: string;
  country: string;
  countryCode: string;
  flag: string;
  group: string;
  latency?: number;
  speed?: number;
  isActive: boolean;
  customName?: string;
  // SS/SSR
  cipher?: string;
  password?: string;
  // VMess/VLESS/Trojan
  sni?: string;
  path?: string;
  host?: string;
  obfs?: string;
  obfsParam?: string;
  // VLESS
  flow?: string;
  encryption?: string;
  // SSR
  protocolParam?: string;
  obfsMode?: string;
  // Hysteria/Hysteria2
  auth?: string;
  alpn?: string;
  recvWindow?: number;
  // TUIC
  tuicVersion?: number;
  congestionController?: string;
  // WireGuard
  privateKey?: string;
  publicKey?: string;
  presharedKey?: string;
  allowedIPs?: string[];
  // Snell
  snellVersion?: number;
  // SSH
  sshUsername?: string;
  sshPassword?: string;
  // Extra
  remarks?: string;
  tags?: string[];
  // 订阅源关联
  subscriptionId?: string;
}

export interface Subscription {
  id: string;
  name: string;
  url: string;
  source: string;
  isActive: boolean;
  lastSync?: string;
  nodeCount: number;
}

export interface Plan {
  id: string;
  name: string;
  price: number;
  duration: number; // 天数
  dataLimit: number; // GB
  speedLimit?: number; // Mbps
  nodeGroups: string[];
  features: string[];
  isPopular: boolean;
  isActive: boolean;
}

export interface PlanNode {
  planId: string;
  nodeId: string;
  customName?: string;
  priority: number;
}

export interface User {
  id: string;
  username: string;
  email: string;
  phone?: string;
  password?: string;
  balance: number;
  plan?: Plan;
  planExpire?: string;
  dataUsed: number;
  subscriptionUrl?: string;
  status: 'active' | 'suspended' | 'expired';
  createdAt: string;
  lastLogin?: string;
  inviteCode?: string; // 用户专属邀请码
  referredBy?: string; // 被谁邀请（邀请码）
  totalInviteRewards?: number; // 累计邀请奖励
  voucherBalance?: number; // 代金券余额
}

export interface Order {
  id: string;
  userId: string;
  planId: string;
  amount: number;
  status: 'pending' | 'paid' | 'processing' | 'completed' | 'cancelled';
  paymentMethod: string;
  createdAt: string;
  paidAt?: string;
}

export interface DashboardStats {
  totalUsers: number;
  activeUsers: number;
  totalRevenue: number;
  totalNodes: number;
  activeNodes: number;
  subscriptionCount: number;
}

export interface Admin {
  id: string;
  username: string;
  password: string;
  role: 'superadmin' | 'admin' | 'operator';
  lastLogin?: string;
}

// 支付配置
export interface PaymentConfig {
  id: string;
  // 支付宝当面付
  alipay: {
    enabled: boolean;
    appId: string;
    privateKey: string;
    alipayPublicKey: string;
    notifyUrl: string;
    returnUrl: string;
    sellerEmail: string;
  };
  // USDT支付
  usdt: {
    enabled: boolean;
    network: 'TRC20' | 'ERC20' | 'BEP20';
    walletAddress: string;
    apiKey: string; // NOWPayments / CoinPayments API Key
    apiSecret: string;
    notifyUrl: string;
    minAmount: number; // 最低充值金额(USD)
  };
  // 通用设置
  currency: string;
  exchangeRate: number; // CNY to USD
  autoConfirm: boolean; // 自动确认支付
  timeout: number; // 支付超时时间(分钟)
}

// 充值记录
export interface Recharge {
  id: string;
  userId: string;
  amount: number;
  currency: string;
  paymentMethod: 'alipay' | 'usdt' | 'wechat' | 'balance';
  status: 'pending' | 'paid' | 'confirmed' | 'failed' | 'expired';
  transactionId?: string;
  qrCode?: string;
  createdAt: string;
  paidAt?: string;
  confirmedAt?: string;
  notes?: string;
}

// 邮件配置
export interface EmailConfig {
  id: string;
  // SMTP 配置
  smtpHost: string;
  smtpPort: number;
  smtpSecure: boolean; // true = 465 (SSL), false = 587 (STARTTLS)
  smtpUser: string;
  smtpPass: string;
  // 发件人信息
  fromName: string;
  fromEmail: string;
  // 邮件模板
  verifySubject: string;
  verifyTemplate: string; // HTML 模板，{code} 为验证码占位符
  // 验证码设置
  codeLength: number;
  codeExpiry: number; // 分钟
  maxAttempts: number; // 最大验证次数
  // 状态
  isEnabled: boolean;
  lastTestStatus?: 'success' | 'failed' | 'pending';
  lastTestTime?: string;
  lastTestError?: string;
}

// 验证码记录
export interface VerificationCode {
  id: string;
  email: string;
  code: string;
  purpose: 'register' | 'reset_password' | 'login';
  createdAt: string;
  expiresAt: string;
  attempts: number;
  maxAttempts: number;
  isUsed: boolean;
  usedAt?: string;
  ip?: string;
}

// 工单系统
export type TicketStatus = 'open' | 'pending' | 'resolved' | 'closed';
export type TicketCategory = 'technical' | 'payment' | 'account' | 'refund' | 'other';
export type TicketPriority = 'low' | 'medium' | 'high' | 'urgent';

export interface TicketMessage {
  id: string;
  ticketId: string;
  senderId: string; // userId 或 adminId
  senderType: 'user' | 'admin' | 'system';
  senderName: string;
  content: string;
  attachments?: string[];
  createdAt: string;
  isRead: boolean;
}

export interface Ticket {
  id: string;
  ticketNo: string;
  userId: string;
  username: string;
  userEmail: string;
  subject: string;
  category: TicketCategory;
  priority: TicketPriority;
  status: TicketStatus;
  assignedAdminId?: string;
  assignedAdminName?: string;
  planId?: string;
  planName?: string;
  orderId?: string;
  createdAt: string;
  updatedAt: string;
  closedAt?: string;
  closedBy?: string;
  lastReplyAt: string;
  unreadCount: number;
  messageCount: number;
  tags?: string[];
  notes?: string; // 管理员内部备注
  lastMessage?: string; // 最后一条消息预览
  messages?: TicketMessage[]; // 消息列表
}

export interface QuickReply {
  id: string;
  title: string;
  content: string;
  category: string;
  usageCount: number;
  isPublic: boolean;
}

// 流量排行
export interface TrafficRanking {
  id: string;
  userId: string;
  username: string;
  email: string;
  planName: string;
  dataUsed: number; // GB
  dataLimit: number; // GB
  usagePercent: number;
  orderCount: number;
  totalSpent: number;
  lastActive: string;
  rank: number;
}

// 节点监控
export interface NodeMonitor {
  nodeId: string;
  nodeName: string;
  server: string;
  port: number;
  protocol: string;
  status: 'online' | 'offline' | 'degraded' | 'checking';
  latency: number; // ms
  packetLoss: number; // %
  uptime: number; // %
  lastCheck: string;
  checkHistory: { time: string; latency: number; status: string }[];
  country: string;
  flag: string;
}

// 仪表盘扩展统计
export interface ExtendedDashboardStats extends DashboardStats {
  todayRevenue: number;
  todayUsers: number;
  todayOrders: number;
  totalTraffic: number; // GB
  avgLatency: number; // ms
  onlineNodes: number;
  offlineNodes: number;
  degradedNodes: number;
  topPlans: { name: string; count: number; revenue: number }[];
  recentTraffic: { time: string; users: number; traffic: number }[];
}

// 邀请系统
export interface InviteConfig {
  id: string;
  enabled: boolean;
  rewardType: 'fixed' | 'percentage'; // 固定金额 or 百分比
  rewardAmount: number; // 固定金额(元) 或 百分比(%)
  maxRewardPerInvite: number; // 单次邀请最大奖励
  maxRewardPerDay: number; // 每日最大奖励
  minPurchaseAmount: number; // 被邀请人最低消费金额
  rewardExpiry: number; // 代金券有效期(天)
  voucherName: string; // 代金券名称
  voucherDescription: string; // 代金券描述
  inviteButtonText: string; // 邀请按钮文案
  shareTitle: string; // 分享标题
  shareDescription: string; // 分享描述
  totalInvites: number; // 总邀请数
  totalRewards: number; // 总发放奖励
  totalRevenue: number; // 邀请带来的总收入
  registerRewardAmount: number; // 注册即送奖励(元)
  purchaseRewardEnabled: boolean; // 购买后是否发放奖励
}

export interface Invitation {
  id: string;
  inviterId: string; // 邀请人ID
  inviterName: string; // 邀请人用户名
  inviteeId: string; // 被邀请人ID
  inviteeName: string; // 被邀请人用户名
  inviteeEmail: string; // 被邀请人邮箱
  inviteCode: string; // 邀请码
  status: 'pending' | 'registered' | 'purchased' | 'rewarded' | 'expired';
  registeredAt?: string;
  purchasedAt?: string;
  purchaseAmount?: number; // 被邀请人购买金额
  rewardAmount: number; // 奖励金额
  rewardedAt?: string;
  voucherId?: string; // 关联的代金券ID
  createdAt: string;
}

export interface Voucher {
  id: string;
  userId: string;
  code: string; // 代金券码
  name: string; // 代金券名称
  description: string;
  type: 'invite' | 'admin' | 'system'; // 来源类型
  amount: number; // 面额
  minOrderAmount: number; // 最低使用门槛
  status: 'available' | 'used' | 'expired';
  sourceType: string; // 来源描述
  sourceId?: string; // 来源ID(邀请记录ID等)
  issuedAt: string;
  expiresAt: string;
  usedAt?: string;
  usedOrderId?: string; // 使用的订单ID
  usageNote?: string; // 使用备注
}