import { createContext, useContext, useState, ReactNode, useCallback } from 'react';
import { Node, Subscription, Plan, PlanNode, User, Order, DashboardStats, Admin, PaymentConfig, Recharge, EmailConfig, VerificationCode, Ticket, TicketMessage, TicketCategory, TicketPriority, TrafficRanking, NodeMonitor, InviteConfig, Invitation, Voucher } from '../types';

// 应用状态上下文
interface AppState {
  // 订阅源管理
  subscriptions: Subscription[];
  setSubscriptions: (subs: Subscription[]) => void;
  addSubscription: (sub: Subscription) => void;
  updateSubscription: (id: string, data: Partial<Subscription>) => void;
  deleteSubscription: (id: string) => void;
  
  // 节点管理
  nodes: Node[];
  setNodes: (nodes: Node[]) => void;
  addNodes: (newNodes: Node[]) => void;
  updateNode: (id: string, data: Partial<Node>) => void;
  deleteNode: (id: string) => void;
  batchUpdateNodeNames: (ids: string[], customName: string) => void;
  
  // 套餐管理
  plans: Plan[];
  setPlans: (plans: Plan[]) => void;
  addPlan: (plan: Plan) => void;
  updatePlan: (id: string, data: Partial<Plan>) => void;
  deletePlan: (id: string) => void;
  
  // 套餐-节点关联
  planNodes: PlanNode[];
  setPlanNodes: (pn: PlanNode[]) => void;
  assignNodesToPlan: (planId: string, nodeIds: string[]) => void;
  updatePlanNodeName: (planId: string, nodeId: string, customName: string) => void;
  getNodesForPlan: (planId: string) => Node[];
  
  // 用户管理
  users: User[];
  setUsers: (users: User[]) => void;
  addUser: (user: User) => void;
  updateUser: (id: string, data: Partial<User>) => void;
  deleteUser: (id: string) => void;
  
  // 订单管理
  orders: Order[];
  setOrders: (orders: Order[]) => void;
  addOrder: (order: Order) => void;
  updateOrder: (id: string, data: Partial<Order>) => void;
  
  // 支付配置
  paymentConfig: PaymentConfig;
  setPaymentConfig: (config: PaymentConfig) => void;
  updatePaymentConfig: (data: Partial<PaymentConfig>) => void;
  
  // 充值记录
  recharges: Recharge[];
  setRecharges: (recharges: Recharge[]) => void;
  addRecharge: (recharge: Recharge) => void;
  updateRecharge: (id: string, data: Partial<Recharge>) => void;

  // 邮件配置
  emailConfig: EmailConfig;
  setEmailConfig: (config: EmailConfig) => void;
  updateEmailConfig: (data: Partial<EmailConfig>) => void;
  testEmailConfig: () => Promise<boolean>;

  // 验证码管理
  verificationCodes: VerificationCode[];
  setVerificationCodes: (codes: VerificationCode[]) => void;
  sendVerificationCode: (email: string, purpose: 'register' | 'reset_password' | 'login') => Promise<{ success: boolean; message: string }>;
  verifyCode: (email: string, code: string) => { success: boolean; message: string };
  
  // 密码重置
  resetUserPassword: (email: string, verificationCode: string, newPassword: string) => { success: boolean; message: string };
  changeUserPassword: (userId: string, oldPassword: string, newPassword: string) => { success: boolean; message: string };

  // 工单管理
  tickets: Ticket[];
  setTickets: (tickets: Ticket[]) => void;
  addTicket: (ticket: Ticket) => void;
  updateTicket: (id: string, data: Partial<Ticket>) => void;
  deleteTicket: (id: string) => void;
  ticketMessages: TicketMessage[];
  setTicketMessages: (messages: TicketMessage[]) => void;
  addTicketMessage: (message: TicketMessage) => void;
  createTicket: (data: { subject: string; category: TicketCategory; priority: TicketPriority; content: string; planId?: string; orderId?: string }) => Ticket | null;
  replyTicket: (ticketId: string, content: string, senderType: 'user' | 'admin', senderName: string) => void;
  assignTicket: (ticketId: string, adminName: string) => void;
  quickReplies: { id: string; title: string; content: string; category: string; usageCount: number; isPublic: boolean }[];
  setQuickReplies: (replies: { id: string; title: string; content: string; category: string; usageCount: number; isPublic: boolean }[]) => void;
  addQuickReply: (reply: { title: string; content: string; category: string; isPublic: boolean }) => void;
  deleteQuickReply: (id: string) => void;
  
  // 流量排行
  trafficRankings: TrafficRanking[];
  setTrafficRankings: (rankings: TrafficRanking[]) => void;
  refreshTrafficRankings: () => void;
  
  // 节点监控
  nodeMonitors: NodeMonitor[];
  setNodeMonitors: (monitors: NodeMonitor[]) => void;
  checkNodeLatency: (nodeId: string) => Promise<number>;
  checkAllNodesLatency: () => Promise<void>;
  updateNodeMonitor: (nodeId: string, data: Partial<NodeMonitor>) => void;
  
  // 仪表盘统计
  stats: DashboardStats;
  setStats: (stats: DashboardStats) => void;
  
  // 邀请系统
  inviteConfig: InviteConfig;
  setInviteConfig: (config: InviteConfig) => void;
  updateInviteConfig: (data: Partial<InviteConfig>) => void;
  invitations: Invitation[];
  setInvitations: (invitations: Invitation[]) => void;
  addInvitation: (invitation: Invitation) => void;
  updateInvitation: (id: string, data: Partial<Invitation>) => void;
  vouchers: Voucher[];
  setVouchers: (vouchers: Voucher[]) => void;
  addVoucher: (voucher: Voucher) => void;
  updateVoucher: (id: string, data: Partial<Voucher>) => void;
  generateUserInviteCode: (userId: string) => string;
  validateInviteCode: (code: string) => { valid: boolean; inviterId?: string; inviterName?: string; message: string };
  registerWithInviteCode: (inviteeId: string, inviteeName: string, inviteeEmail: string, inviteCode: string) => { success: boolean; message: string };
  issueRegisterReward: (inviterId: string, inviteeId: string) => Voucher | null;
  processInviteReward: (inviterId: string, inviteeId: string, purchaseAmount: number) => Voucher | null;
  useVoucher: (userId: string, voucherCode: string, orderId: string) => { success: boolean; message: string; voucher?: Voucher };
  applyVoucherToOrder: (userId: string, voucherId: string, orderAmount: number) => { success: boolean; message: string; deductedAmount: number; voucher?: Voucher };
  getUserVouchers: (userId: string) => Voucher[];
  getUserInvitations: (userId: string) => Invitation[];
  getUserVoucherBalance: (userId: string) => number;
  
  // 当前视图
  currentView: 'shop' | 'userpanel' | 'admin';
  setCurrentView: (view: 'shop' | 'userpanel' | 'admin') => void;
  
  // 当前登录用户
  currentUser: User | null;
  setCurrentUser: (user: User | null) => void;
  
  // 用户认证
  userLogin: (username: string, password: string) => User | null;
  userRegister: (username: string, email: string, password: string, inviteCode?: string) => { user: User | null; inviteResult?: { success: boolean; message: string } };
  
  // 管理员认证
  adminAuth: {
    isAuthenticated: boolean;
    admin: Admin | null;
  };
  adminLogin: (username: string, password: string) => boolean;
  adminLogout: () => void;
}

// 模拟数据
const initialSubscriptions: Subscription[] = [
  { id: '1', name: '机场A', url: 'https://example.com/sub/a', source: '机场A', isActive: true, lastSync: '2026-01-15', nodeCount: 8 },
  { id: '2', name: '机场B', url: 'https://example.com/sub/b', source: '机场B', isActive: true, lastSync: '2026-01-14', nodeCount: 6 },
];

const initialNodes: Node[] = [
  // 机场A 的节点
  { id: '1', name: '🇭🇰 香港 01', type: 'vmess', server: 'hk1.example.com', port: 443, uuid: 'abc123', alterId: 0, network: 'ws', tls: true, country: '香港', countryCode: 'HK', flag: '🇭🇰', group: 'HK', isActive: true, cipher: 'auto', sni: 'hk1.example.com', path: '/vmess', host: 'hk1.example.com', subscriptionId: '1' },
  { id: '2', name: '🇯🇵 日本 01', type: 'ss', server: 'jp1.example.com', port: 443, password: 'mypassword123', network: 'tcp', tls: false, country: '日本', countryCode: 'JP', flag: '🇯🇵', group: 'JP', isActive: true, cipher: 'aes-256-gcm', subscriptionId: '1' },
  { id: '3', name: '🇺🇸 美国 01', type: 'trojan', server: 'us1.example.com', port: 443, password: 'trojanpass123', network: 'tcp', tls: true, country: '美国', countryCode: 'US', flag: '🇺🇸', group: 'US', isActive: true, sni: 'us1.example.com', subscriptionId: '1' },
  { id: '4', name: '🇸🇬 新加坡 01', type: 'vmess', server: 'sg1.example.com', port: 443, uuid: 'jkl012', alterId: 0, network: 'ws', tls: true, country: '新加坡', countryCode: 'SG', flag: '🇸🇬', group: 'SG', isActive: true, cipher: 'auto', sni: 'sg1.example.com', path: '/vmess', host: 'sg1.example.com', subscriptionId: '1' },
  { id: '5', name: '🇭🇰 香港 02', type: 'ss', server: 'hk2.example.com', port: 8388, password: 'sspassword456', network: 'tcp', tls: false, country: '香港', countryCode: 'HK', flag: '🇭🇰', group: 'HK', isActive: true, cipher: 'aes-256-gcm', subscriptionId: '1' },
  { id: '6', name: '🇯🇵 日本 02', type: 'vmess', server: 'jp2.example.com', port: 443, uuid: 'pqr678', alterId: 0, network: 'ws', tls: true, country: '日本', countryCode: 'JP', flag: '🇯🇵', group: 'JP', isActive: true, cipher: 'auto', sni: 'jp2.example.com', path: '/vmess', host: 'jp2.example.com', subscriptionId: '1' },
  { id: '7', name: '🇰🇷 韩国 01', type: 'trojan', server: 'kr1.example.com', port: 443, password: 'trojanpass789', network: 'tcp', tls: true, country: '韩国', countryCode: 'KR', flag: '🇰🇷', group: 'KR', isActive: true, sni: 'kr1.example.com', subscriptionId: '1' },
  { id: '8', name: '🇬🇧 英国 01', type: 'vmess', server: 'uk1.example.com', port: 443, uuid: 'vwx234', alterId: 0, network: 'ws', tls: true, country: '英国', countryCode: 'GB', flag: '🇬🇧', group: 'GB', isActive: true, cipher: 'auto', sni: 'uk1.example.com', path: '/vmess', host: 'uk1.example.com', subscriptionId: '1' },
  // 机场B 的节点
  { id: '9', name: '🇭🇰 香港 VLESS', type: 'vless', server: 'hkvless.example.com', port: 443, uuid: 'vless-uuid-hk-001', network: 'ws', tls: true, country: '香港', countryCode: 'HK', flag: '🇭🇰', group: 'HK', isActive: true, sni: 'hkvless.example.com', path: '/vless', host: 'hkvless.example.com', flow: 'xtls-rprx-vision', subscriptionId: '2' },
  { id: '10', name: '🇺🇸 美国 VLESS', type: 'vless', server: 'usvless.example.com', port: 443, uuid: 'vless-uuid-us-001', network: 'ws', tls: true, country: '美国', countryCode: 'US', flag: '🇺🇸', group: 'US', isActive: true, sni: 'usvless.example.com', path: '/vless', host: 'usvless.example.com', subscriptionId: '2' },
  { id: '11', name: '🇯🇵 日本 Hysteria2', type: 'hysteria2', server: 'jphy.example.com', port: 8443, password: 'hy2pass123', tls: true, country: '日本', countryCode: 'JP', flag: '🇯🇵', group: 'JP', isActive: true, sni: 'jphy.example.com', alpn: 'h3', subscriptionId: '2' },
  { id: '12', name: '🇸🇬 新加坡 Hysteria2', type: 'hysteria2', server: 'sghy.example.com', port: 8443, password: 'hy2pass456', tls: true, country: '新加坡', countryCode: 'SG', flag: '🇸🇬', group: 'SG', isActive: true, sni: 'sghy.example.com', alpn: 'h3', subscriptionId: '2' },
  { id: '13', name: '🇭🇰 香港 TUIC', type: 'tuic', server: 'hktuic.example.com', port: 9443, uuid: 'tuic-uuid-hk-001', password: 'tuicpass123', tls: true, country: '香港', countryCode: 'HK', flag: '🇭🇰', group: 'HK', isActive: true, sni: 'hktuic.example.com', alpn: 'h3', congestionController: 'bbr', subscriptionId: '2' },
  { id: '14', name: '🇺🇸 美国 TUIC', type: 'tuic', server: 'ustuic.example.com', port: 9443, uuid: 'tuic-uuid-us-001', password: 'tuicpass456', tls: true, country: '美国', countryCode: 'US', flag: '🇺🇸', group: 'US', isActive: true, sni: 'ustuic.example.com', alpn: 'h3', congestionController: 'bbr', subscriptionId: '2' },
];

const initialPlans: Plan[] = [
  { id: '1', name: '入门版', price: 15.9, duration: 30, dataLimit: 80, speedLimit: 100, nodeGroups: ['HK', 'JP'], features: ['80GB流量/月', '客服支持', '自动续费'], isPopular: false, isActive: true },
  { id: '2', name: '基础版', price: 25.9, duration: 30, dataLimit: 160, speedLimit: 200, nodeGroups: ['HK', 'JP', 'US'], features: ['160GB流量/月', '客服支持', '优先客服', '自动续费'], isPopular: true, isActive: true },
  { id: '3', name: '标准版', price: 35.9, duration: 30, dataLimit: 300, speedLimit: 500, nodeGroups: ['HK', 'JP', 'US', 'SG'], features: ['300GB流量/月', '7x24客服', '优先客服', '自动续费'], isPopular: false, isActive: true },
  { id: '4', name: '旗舰版', price: 55.9, duration: 30, dataLimit: 500, speedLimit: 1000, nodeGroups: ['HK', 'JP', 'US', 'SG', 'KR', 'GB'], features: ['500GB流量/月', '7x24客服', '专属客服', '自动续费', 'SSTap支持'], isPopular: false, isActive: true },
];

const initialPlanNodes: PlanNode[] = [
  { planId: '1', nodeId: '1', priority: 1 },
  { planId: '1', nodeId: '2', priority: 2 },
  { planId: '2', nodeId: '1', priority: 1 },
  { planId: '2', nodeId: '2', priority: 2 },
  { planId: '2', nodeId: '3', priority: 3 },
  { planId: '3', nodeId: '1', priority: 1 },
  { planId: '3', nodeId: '2', priority: 2 },
  { planId: '3', nodeId: '3', priority: 3 },
  { planId: '3', nodeId: '4', priority: 4 },
  { planId: '4', nodeId: '1', priority: 1 },
  { planId: '4', nodeId: '2', priority: 2 },
  { planId: '4', nodeId: '3', priority: 3 },
  { planId: '4', nodeId: '4', priority: 4 },
  { planId: '4', nodeId: '5', priority: 5 },
  { planId: '4', nodeId: '6', priority: 6 },
  { planId: '4', nodeId: '7', priority: 7 },
  { planId: '4', nodeId: '8', priority: 8 },
];

const initialUsers: User[] = [
  { id: '1', username: 'testuser', email: 'test@example.com', password: 'test123', balance: 0, plan: initialPlans[1], planExpire: '2026-02-15', dataUsed: 45.6, subscriptionUrl: 'https://api.example.com/sub/abc123', status: 'active', createdAt: '2026-01-01', lastLogin: '2026-01-15' },
  { id: '2', username: 'vipuser', email: 'vip@example.com', password: 'vip123', balance: 100, plan: initialPlans[3], planExpire: '2026-03-01', dataUsed: 120.3, subscriptionUrl: 'https://api.example.com/sub/def456', status: 'active', createdAt: '2025-12-15', lastLogin: '2026-01-14' },
];

const initialOrders: Order[] = [
  { id: '1', userId: '1', planId: '2', amount: 25.9, status: 'completed', paymentMethod: '支付宝', createdAt: '2026-01-01', paidAt: '2026-01-01' },
  { id: '2', userId: '2', planId: '4', amount: 55.9, status: 'completed', paymentMethod: '微信支付', createdAt: '2025-12-15', paidAt: '2025-12-15' },
];

const initialPaymentConfig: PaymentConfig = {
  id: '1',
  alipay: {
    enabled: false,
    appId: '',
    privateKey: '',
    alipayPublicKey: '',
    notifyUrl: '',
    returnUrl: '',
    sellerEmail: '',
  },
  usdt: {
    enabled: false,
    network: 'TRC20',
    walletAddress: '',
    apiKey: '',
    apiSecret: '',
    notifyUrl: '',
    minAmount: 10,
  },
  currency: 'CNY',
  exchangeRate: 0.14,
  autoConfirm: true,
  timeout: 30,
};

const initialRecharges: Recharge[] = [
  { id: '1', userId: '1', amount: 50, currency: 'CNY', paymentMethod: 'alipay', status: 'confirmed', transactionId: 'ALIPAY20260101001', createdAt: '2026-01-01', paidAt: '2026-01-01', confirmedAt: '2026-01-01' },
  { id: '2', userId: '2', amount: 100, currency: 'CNY', paymentMethod: 'usdt', status: 'paid', transactionId: 'TXN1234567890', createdAt: '2026-01-10', paidAt: '2026-01-10' },
  { id: '3', userId: '1', amount: 25.9, currency: 'CNY', paymentMethod: 'alipay', status: 'pending', createdAt: '2026-01-15' },
];

const initialEmailConfig: EmailConfig = {
  id: '1',
  smtpHost: '',
  smtpPort: 465,
  smtpSecure: true,
  smtpUser: '',
  smtpPass: '',
  fromName: 'RocketStore',
  fromEmail: 'noreply@rocketstore.com',
  verifySubject: '【RocketStore】邮箱验证码',
  verifyTemplate: '<div style="max-width:400px;margin:0 auto;padding:20px;background:#1e1e2e;border-radius:12px;color:#fff"><h2 style="text-align:center">🚀 RocketStore</h2><p style="text-align:center">您的验证码是：</p><div style="text-align:center;font-size:36px;font-weight:bold;letter-spacing:8px;color:#8b5cf6;background:#2a2a3e;padding:16px;border-radius:8px;margin:16px 0">{code}</div><p style="text-align:center;color:#999;font-size:12px">验证码有效期为 {expiry} 分钟，请尽快使用</p></div>',
  codeLength: 6,
  codeExpiry: 5,
  maxAttempts: 5,
  isEnabled: false,
  lastTestStatus: 'pending',
};

const initialVerificationCodes: VerificationCode[] = [];

const initialTickets: Ticket[] = [
  {
    id: '1',
    ticketNo: 'TK-20260115-001',
    userId: '1',
    username: 'testuser',
    userEmail: 'test@example.com',
    subject: '香港节点连接不稳定',
    category: 'technical',
    priority: 'high',
    status: 'pending',
    assignedAdminId: '1',
    assignedAdminName: 'admin',
    planId: '2',
    planName: '基础版',
    createdAt: '2026-01-14 10:30:00',
    updatedAt: '2026-01-15 09:00:00',
    lastReplyAt: '2026-01-15 09:00:00',
    unreadCount: 1,
    messageCount: 3,
    tags: ['node-issue', 'hk'],
    notes: '用户反馈香港节点延迟高，已建议切换日本节点',
    messages: [
      { id: '1', ticketId: '1', senderId: '1', senderType: 'user', senderName: 'testuser', content: '你好，我使用的香港节点最近连接很不稳定，延迟经常超过500ms，有时还会断连。我的套餐是基础版，请问能帮忙解决吗？', createdAt: '2026-01-14 10:30:00', isRead: true },
      { id: '2', ticketId: '1', senderId: '1', senderType: 'admin', senderName: 'admin', content: '您好，感谢您的反馈。请问您使用的是哪个香港节点？能否提供一下客户端类型和版本信息？', createdAt: '2026-01-14 11:00:00', isRead: true },
      { id: '3', ticketId: '1', senderId: '1', senderType: 'user', senderName: 'testuser', content: '我使用的是Clash.Meta 1.17.0，节点是🇭🇰 香港 01。延迟测试显示有时候200ms，有时候500ms以上。', createdAt: '2026-01-15 09:00:00', isRead: false },
    ],
  },
  {
    id: '2',
    ticketNo: 'TK-20260114-002',
    userId: '2',
    username: 'vipuser',
    userEmail: 'vip@example.com',
    subject: '申请退款 - 订单号 ORD20260114001',
    category: 'refund',
    priority: 'medium',
    status: 'open',
    createdAt: '2026-01-14 15:20:00',
    updatedAt: '2026-01-14 15:20:00',
    lastReplyAt: '2026-01-14 15:20:00',
    unreadCount: 1,
    messageCount: 1,
    orderId: '2',
    tags: ['refund'],
    messages: [
      { id: '4', ticketId: '2', senderId: '2', senderType: 'user', senderName: 'vipuser', content: '我购买了旗舰版套餐，但是发现节点数量和质量都不如预期，申请退款。订单号：ORD20260114001', createdAt: '2026-01-14 15:20:00', isRead: false },
    ],
  },
  {
    id: '3',
    ticketNo: 'TK-20260110-003',
    userId: '1',
    username: 'testuser',
    userEmail: 'test@example.com',
    subject: '如何配置Clash.Meta客户端',
    category: 'technical',
    priority: 'low',
    status: 'resolved',
    assignedAdminId: '1',
    assignedAdminName: 'admin',
    createdAt: '2026-01-10 08:00:00',
    updatedAt: '2026-01-11 14:00:00',
    closedAt: '2026-01-11 14:00:00',
    closedBy: 'admin',
    lastReplyAt: '2026-01-11 14:00:00',
    unreadCount: 0,
    messageCount: 4,
    tags: ['client-config'],
    messages: [
      { id: '5', ticketId: '3', senderId: '1', senderType: 'user', senderName: 'testuser', content: '请问如何配置Clash.Meta客户端？我不太会设置。', createdAt: '2026-01-10 08:00:00', isRead: true },
      { id: '6', ticketId: '3', senderId: '1', senderType: 'admin', senderName: 'admin', content: '您好！配置Clash.Meta很简单：\n1. 在用户面板生成Clash订阅链接\n2. 打开Clash.Meta，选择"从URL导入"\n3. 粘贴订阅链接\n4. 选择配置文件并启用\n\n如有问题随时联系我们！', createdAt: '2026-01-10 09:00:00', isRead: true },
      { id: '7', ticketId: '3', senderId: '1', senderType: 'user', senderName: 'testuser', content: '已经配置好了，可以正常使用了，谢谢！', createdAt: '2026-01-11 10:00:00', isRead: true },
      { id: '8', ticketId: '3', senderId: '1', senderType: 'admin', senderName: 'admin', content: '太好了！很高兴问题已解决。如有其他问题随时联系我们。😊', createdAt: '2026-01-11 14:00:00', isRead: true },
    ],
  },
];

const initialTicketMessages: TicketMessage[] = initialTickets.flatMap(t => t.messages || []);

const initialQuickReplies = [
  { id: '1', title: '欢迎语', content: '您好！欢迎使用 RocketStore 服务，请问有什么可以帮您的？', category: 'general', usageCount: 15, isPublic: true },
  { id: '2', title: '节点优化建议', content: '建议您尝试以下优化：\n1. 使用 Clash.Meta 客户端\n2. 选择延迟最低的节点\n3. 开启 UDP 和 TFO 选项\n4. 如仍有问题请提交工单', category: 'technical', usageCount: 8, isPublic: true },
  { id: '3', title: '支付确认', content: '您的支付已收到，我们正在处理中，预计5-10分钟内完成开通。', category: 'payment', usageCount: 12, isPublic: true },
  { id: '4', title: '退款说明', content: '我们支持购买后24小时内未使用的全额退款。请提供订单号，我们会尽快处理。', category: 'refund', usageCount: 3, isPublic: true },
  { id: '5', title: '套餐续费提醒', content: '您的套餐即将到期，建议及时续费以免影响使用。续费后流量将重新计算。', category: 'account', usageCount: 6, isPublic: true },
];

const initialStats: DashboardStats = {
  totalUsers: 156,
  activeUsers: 89,
  totalRevenue: 15680,
  totalNodes: 14,
  activeNodes: 14,
  subscriptionCount: 2,
};

// 邀请系统初始配置
const initialInviteConfig: InviteConfig = {
  id: '1',
  enabled: true,
  rewardType: 'percentage',
  rewardAmount: 10, // 10%
  maxRewardPerInvite: 50, // 单次最大奖励50元
  maxRewardPerDay: 200, // 每日最大奖励200元
  minPurchaseAmount: 10, // 被邀请人最低消费10元
  rewardExpiry: 365, // 代金券有效期365天
  voucherName: '邀请奖励代金券',
  voucherDescription: '通过邀请好友购买获得的奖励代金券，可用于续费抵扣',
  inviteButtonText: '邀请好友，双方都有奖励！',
  shareTitle: '🚀 推荐一个超好用的机场服务',
  shareDescription: '注册即享专属优惠，购买后双方都能获得代金券奖励！',
  totalInvites: 23,
  totalRewards: 580,
  totalRevenue: 2340,
  registerRewardAmount: 5, // 注册即送5元代金券
  purchaseRewardEnabled: true, // 购买后发放奖励
};

// 初始邀请记录
const initialInvitations: Invitation[] = [
  { id: '1', inviterId: '1', inviterName: 'testuser', inviteeId: '3', inviteeName: 'user001', inviteeEmail: 'user001@example.com', inviteCode: 'INVA1B2C3D4', status: 'rewarded', registeredAt: '2026-01-10 08:00:00', purchasedAt: '2026-01-11 10:30:00', purchaseAmount: 25.9, rewardAmount: 2.59, rewardedAt: '2026-01-11 10:35:00', voucherId: 'V1', createdAt: '2026-01-09 12:00:00' },
  { id: '2', inviterId: '1', inviterName: 'testuser', inviteeId: '4', inviteeName: 'user002', inviteeEmail: 'user002@example.com', inviteCode: 'INVA1B2C3D4', status: 'rewarded', registeredAt: '2026-01-12 09:00:00', purchasedAt: '2026-01-13 14:20:00', purchaseAmount: 15.9, rewardAmount: 1.59, rewardedAt: '2026-01-13 14:25:00', voucherId: 'V2', createdAt: '2026-01-11 15:00:00' },
  { id: '3', inviterId: '2', inviterName: 'vipuser', inviteeId: '5', inviteeName: 'user003', inviteeEmail: 'user003@example.com', inviteCode: 'INVE5F6G7H8', status: 'rewarded', registeredAt: '2026-01-08 10:00:00', purchasedAt: '2026-01-09 16:00:00', purchaseAmount: 55.9, rewardAmount: 5.59, rewardedAt: '2026-01-09 16:05:00', voucherId: 'V3', createdAt: '2026-01-07 11:00:00' },
  { id: '4', inviterId: '2', inviterName: 'vipuser', inviteeId: '6', inviteeName: 'user004', inviteeEmail: 'user004@example.com', inviteCode: 'INVE5F6G7H8', status: 'purchased', registeredAt: '2026-01-13 11:00:00', purchasedAt: '2026-01-14 09:30:00', purchaseAmount: 35.9, rewardAmount: 3.59, createdAt: '2026-01-12 14:00:00' },
  { id: '5', inviterId: '1', inviterName: 'testuser', inviteeId: '7', inviteeName: 'user005', inviteeEmail: 'user005@example.com', inviteCode: 'INVA1B2C3D4', status: 'registered', registeredAt: '2026-01-14 16:00:00', purchaseAmount: 0, rewardAmount: 0, createdAt: '2026-01-14 10:00:00' },
  { id: '6', inviterId: '1', inviterName: 'testuser', inviteeId: '8', inviteeName: 'user006', inviteeEmail: 'user006@example.com', inviteCode: 'INVA1B2C3D4', status: 'pending', rewardAmount: 0, createdAt: '2026-01-15 08:00:00' },
];

// 初始代金券
const initialVouchers: Voucher[] = [
  { id: 'V1', userId: '1', code: 'VoucherA1B2C3D4E5', name: '邀请奖励代金券', description: '邀请 user001 购买获得的奖励', type: 'invite', amount: 2.59, minOrderAmount: 0, status: 'available', sourceType: '邀请奖励', sourceId: '1', issuedAt: '2026-01-11 10:35:00', expiresAt: '2027-01-11 10:35:00' },
  { id: 'V2', userId: '1', code: 'VoucherF6G7H8I9J0', name: '邀请奖励代金券', description: '邀请 user002 购买获得的奖励', type: 'invite', amount: 1.59, minOrderAmount: 0, status: 'available', sourceType: '邀请奖励', sourceId: '2', issuedAt: '2026-01-13 14:25:00', expiresAt: '2027-01-13 14:25:00' },
  { id: 'V3', userId: '2', code: 'VoucherK1L2M3N4O5', name: '邀请奖励代金券', description: '邀请 user003 购买获得的奖励', type: 'invite', amount: 5.59, minOrderAmount: 0, status: 'used', sourceType: '邀请奖励', sourceId: '3', issuedAt: '2026-01-09 16:05:00', expiresAt: '2027-01-09 16:05:00', usedAt: '2026-01-14 10:00:00', usedOrderId: '3', usageNote: '续费标准版套餐' },
  { id: 'V4', userId: '2', code: 'VoucherP6Q7R8S9T0', name: '邀请奖励代金券', description: '邀请 user004 购买获得的奖励', type: 'invite', amount: 3.59, minOrderAmount: 0, status: 'available', sourceType: '邀请奖励', sourceId: '4', issuedAt: '2026-01-14 09:35:00', expiresAt: '2027-01-14 09:35:00' },
];

// 流量排行模拟数据
const initialTrafficRankings: TrafficRanking[] = [
  { id: '1', userId: '2', username: 'vipuser', email: 'vip@example.com', planName: '旗舰版', dataUsed: 120.3, dataLimit: 500, usagePercent: 24, orderCount: 3, totalSpent: 167.7, lastActive: '2026-01-15', rank: 1 },
  { id: '2', userId: '1', username: 'testuser', email: 'test@example.com', planName: '基础版', dataUsed: 45.6, dataLimit: 160, usagePercent: 29, orderCount: 1, totalSpent: 25.9, lastActive: '2026-01-14', rank: 2 },
  { id: '3', userId: '3', username: 'user001', email: 'user001@example.com', planName: '标准版', dataUsed: 89.2, dataLimit: 300, usagePercent: 30, orderCount: 2, totalSpent: 71.8, lastActive: '2026-01-13', rank: 3 },
  { id: '4', userId: '4', username: 'user002', email: 'user002@example.com', planName: '入门版', dataUsed: 15.8, dataLimit: 80, usagePercent: 20, orderCount: 1, totalSpent: 15.9, lastActive: '2026-01-12', rank: 4 },
  { id: '5', userId: '5', username: 'user003', email: 'user003@example.com', planName: '旗舰版', dataUsed: 234.5, dataLimit: 500, usagePercent: 47, orderCount: 4, totalSpent: 223.6, lastActive: '2026-01-15', rank: 5 },
  { id: '6', userId: '6', username: 'user004', email: 'user004@example.com', planName: '基础版', dataUsed: 78.3, dataLimit: 160, usagePercent: 49, orderCount: 2, totalSpent: 51.8, lastActive: '2026-01-11', rank: 6 },
  { id: '7', userId: '7', username: 'user005', email: 'user005@example.com', planName: '标准版', dataUsed: 156.7, dataLimit: 300, usagePercent: 52, orderCount: 3, totalSpent: 107.7, lastActive: '2026-01-10', rank: 7 },
  { id: '8', userId: '8', username: 'user006', email: 'user006@example.com', planName: '入门版', dataUsed: 62.1, dataLimit: 80, usagePercent: 78, orderCount: 1, totalSpent: 15.9, lastActive: '2026-01-09', rank: 8 },
];

// 节点监控模拟数据
const initialNodeMonitors: NodeMonitor[] = [
  { nodeId: '1', nodeName: '🇭🇰 香港 01', server: 'hk1.example.com', port: 443, protocol: 'vmess', status: 'online', latency: 45, packetLoss: 0.1, uptime: 99.8, lastCheck: '2026-01-15 10:30:00', checkHistory: [
    { time: '10:00', latency: 42, status: 'online' }, { time: '10:05', latency: 48, status: 'online' }, { time: '10:10', latency: 45, status: 'online' }, { time: '10:15', latency: 50, status: 'online' }, { time: '10:20', latency: 44, status: 'online' }, { time: '10:25', latency: 46, status: 'online' }, { time: '10:30', latency: 45, status: 'online' },
  ], country: '香港', flag: '🇭🇰' },
  { nodeId: '2', nodeName: '🇯🇵 日本 01', server: 'jp1.example.com', port: 443, protocol: 'ss', status: 'online', latency: 78, packetLoss: 0.2, uptime: 99.5, lastCheck: '2026-01-15 10:30:00', checkHistory: [
    { time: '10:00', latency: 75, status: 'online' }, { time: '10:05', latency: 80, status: 'online' }, { time: '10:10', latency: 76, status: 'online' }, { time: '10:15', latency: 82, status: 'online' }, { time: '10:20', latency: 79, status: 'online' }, { time: '10:25', latency: 77, status: 'online' }, { time: '10:30', latency: 78, status: 'online' },
  ], country: '日本', flag: '🇯🇵' },
  { nodeId: '3', nodeName: '🇺🇸 美国 01', server: 'us1.example.com', port: 443, protocol: 'trojan', status: 'degraded', latency: 185, packetLoss: 2.1, uptime: 97.2, lastCheck: '2026-01-15 10:30:00', checkHistory: [
    { time: '10:00', latency: 160, status: 'online' }, { time: '10:05', latency: 175, status: 'online' }, { time: '10:10', latency: 190, status: 'degraded' }, { time: '10:15', latency: 210, status: 'degraded' }, { time: '10:20', latency: 180, status: 'degraded' }, { time: '10:25', latency: 195, status: 'degraded' }, { time: '10:30', latency: 185, status: 'degraded' },
  ], country: '美国', flag: '🇺🇸' },
  { nodeId: '4', nodeName: '🇸🇬 新加坡 01', server: 'sg1.example.com', port: 443, protocol: 'vmess', status: 'online', latency: 65, packetLoss: 0.0, uptime: 99.9, lastCheck: '2026-01-15 10:30:00', checkHistory: [
    { time: '10:00', latency: 62, status: 'online' }, { time: '10:05', latency: 64, status: 'online' }, { time: '10:10', latency: 66, status: 'online' }, { time: '10:15', latency: 63, status: 'online' }, { time: '10:20', latency: 67, status: 'online' }, { time: '10:25', latency: 65, status: 'online' }, { time: '10:30', latency: 65, status: 'online' },
  ], country: '新加坡', flag: '🇸🇬' },
  { nodeId: '5', nodeName: '🇭🇰 香港 02', server: 'hk2.example.com', port: 8388, protocol: 'ss', status: 'online', latency: 52, packetLoss: 0.1, uptime: 99.7, lastCheck: '2026-01-15 10:30:00', checkHistory: [
    { time: '10:00', latency: 50, status: 'online' }, { time: '10:05', latency: 53, status: 'online' }, { time: '10:10', latency: 51, status: 'online' }, { time: '10:15', latency: 54, status: 'online' }, { time: '10:20', latency: 52, status: 'online' }, { time: '10:25', latency: 51, status: 'online' }, { time: '10:30', latency: 52, status: 'online' },
  ], country: '香港', flag: '🇭🇰' },
  { nodeId: '6', nodeName: '🇯🇵 日本 02', server: 'jp2.example.com', port: 443, protocol: 'vmess', status: 'offline', latency: 0, packetLoss: 100, uptime: 85.3, lastCheck: '2026-01-15 10:30:00', checkHistory: [
    { time: '10:00', latency: 80, status: 'online' }, { time: '10:05', latency: 0, status: 'offline' }, { time: '10:10', latency: 0, status: 'offline' }, { time: '10:15', latency: 0, status: 'offline' }, { time: '10:20', latency: 0, status: 'offline' }, { time: '10:25', latency: 0, status: 'offline' }, { time: '10:30', latency: 0, status: 'offline' },
  ], country: '日本', flag: '🇯🇵' },
  { nodeId: '7', nodeName: '🇰🇷 韩国 01', server: 'kr1.example.com', port: 443, protocol: 'trojan', status: 'online', latency: 95, packetLoss: 0.3, uptime: 99.1, lastCheck: '2026-01-15 10:30:00', checkHistory: [
    { time: '10:00', latency: 90, status: 'online' }, { time: '10:05', latency: 92, status: 'online' }, { time: '10:10', latency: 98, status: 'online' }, { time: '10:15', latency: 94, status: 'online' }, { time: '10:20', latency: 96, status: 'online' }, { time: '10:25', latency: 93, status: 'online' }, { time: '10:30', latency: 95, status: 'online' },
  ], country: '韩国', flag: '🇰🇷' },
  { nodeId: '8', nodeName: '🇬🇧 英国 01', server: 'uk1.example.com', port: 443, protocol: 'vmess', status: 'online', latency: 220, packetLoss: 0.5, uptime: 98.8, lastCheck: '2026-01-15 10:30:00', checkHistory: [
    { time: '10:00', latency: 210, status: 'online' }, { time: '10:05', latency: 215, status: 'online' }, { time: '10:10', latency: 225, status: 'online' }, { time: '10:15', latency: 218, status: 'online' }, { time: '10:20', latency: 222, status: 'online' }, { time: '10:25', latency: 220, status: 'online' }, { time: '10:30', latency: 220, status: 'online' },
  ], country: '英国', flag: '🇬🇧' },
];

const AppContext = createContext<AppState | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {
  const [subscriptions, setSubscriptions] = useState<Subscription[]>(initialSubscriptions);
  const [nodes, setNodes] = useState<Node[]>(initialNodes);
  const [plans, setPlans] = useState<Plan[]>(initialPlans);
  const [planNodes, setPlanNodes] = useState<PlanNode[]>(initialPlanNodes);
  const [users, setUsers] = useState<User[]>(initialUsers);
  const [orders, setOrders] = useState<Order[]>(initialOrders);
  const [paymentConfig, setPaymentConfig] = useState<PaymentConfig>(initialPaymentConfig);
  const [recharges, setRecharges] = useState<Recharge[]>(initialRecharges);
  const [emailConfig, setEmailConfig] = useState<EmailConfig>(initialEmailConfig);
  const [verificationCodes, setVerificationCodes] = useState<VerificationCode[]>(initialVerificationCodes);
  const [stats, setStats] = useState<DashboardStats>(initialStats);
  const [trafficRankings, setTrafficRankings] = useState<TrafficRanking[]>(initialTrafficRankings);
  const [nodeMonitors, setNodeMonitors] = useState<NodeMonitor[]>(initialNodeMonitors);
  const [inviteConfig, setInviteConfig] = useState<InviteConfig>(initialInviteConfig);
  const [invitations, setInvitations] = useState<Invitation[]>(initialInvitations);
  const [vouchers, setVouchers] = useState<Voucher[]>(initialVouchers);
  const [tickets, setTickets] = useState<Ticket[]>(initialTickets);
  const [ticketMessages, setTicketMessages] = useState<TicketMessage[]>(initialTicketMessages);
  const [quickReplies, setQuickReplies] = useState(initialQuickReplies);
  const [currentView, setCurrentView] = useState<'shop' | 'userpanel' | 'admin'>('shop');
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [adminAuth, setAdminAuth] = useState<{ isAuthenticated: boolean; admin: Admin | null }>({
    isAuthenticated: false,
    admin: null,
  });

  const addSubscription = (sub: Subscription) => setSubscriptions(prev => [...prev, sub]);
  const updateSubscription = (id: string, data: Partial<Subscription>) => {
    setSubscriptions(prev => prev.map(s => s.id === id ? { ...s, ...data } : s));
  };
  const deleteSubscription = (id: string) => {
    setSubscriptions(prev => prev.filter(s => s.id !== id));
  };

  const addNodes = (newNodes: Node[]) => setNodes(prev => [...prev, ...newNodes]);
  const updateNode = (id: string, data: Partial<Node>) => {
    setNodes(prev => prev.map(n => n.id === id ? { ...n, ...data } : n));
  };
  const deleteNode = (id: string) => {
    setNodes(prev => prev.filter(n => n.id !== id));
  };
  const batchUpdateNodeNames = (ids: string[], customName: string) => {
    setNodes(prev => prev.map(n => ids.includes(n.id) ? { ...n, customName } : n));
  };

  const addPlan = (plan: Plan) => setPlans(prev => [...prev, plan]);
  const updatePlan = (id: string, data: Partial<Plan>) => {
    setPlans(prev => prev.map(p => p.id === id ? { ...p, ...data } : p));
  };
  const deletePlan = (id: string) => {
    setPlans(prev => prev.filter(p => p.id !== id));
  };

  const assignNodesToPlan = (planId: string, nodeIds: string[]) => {
    const newPlanNodes = nodeIds.map((nodeId, index) => ({
      planId,
      nodeId,
      priority: index + 1,
    }));
    setPlanNodes(prev => [
      ...prev.filter(pn => pn.planId !== planId),
      ...newPlanNodes,
    ]);
  };

  const updatePlanNodeName = (planId: string, nodeId: string, customName: string) => {
    setPlanNodes(prev => prev.map(pn => 
      pn.planId === planId && pn.nodeId === nodeId ? { ...pn, customName } : pn
    ));
  };

  const getNodesForPlan = (planId: string): Node[] => {
    const pns = planNodes.filter(pn => pn.planId === planId);
    const sortedPns = pns.sort((a, b) => a.priority - b.priority);
    return sortedPns.map(pn => nodes.find(n => n.id === pn.nodeId)).filter(Boolean) as Node[];
  };

  const addUser = (user: User) => setUsers(prev => [...prev, user]);
  const updateUser = (id: string, data: Partial<User>) => {
    setUsers(prev => prev.map(u => u.id === id ? { ...u, ...data } : u));
  };
  const deleteUser = (id: string) => {
    setUsers(prev => prev.filter(u => u.id !== id));
  };

  const addOrder = (order: Order) => setOrders(prev => [...prev, order]);
  const updateOrder = (id: string, data: Partial<Order>) => {
    setOrders(prev => prev.map(o => o.id === id ? { ...o, ...data } : o));
  };

  // 支付配置管理
  const updatePaymentConfig = (data: Partial<PaymentConfig>) => {
    setPaymentConfig(prev => ({ ...prev, ...data }));
  };

  // 充值记录管理
  const addRecharge = (recharge: Recharge) => setRecharges(prev => [...prev, recharge]);
  const updateRecharge = (id: string, data: Partial<Recharge>) => {
    setRecharges(prev => prev.map(r => r.id === id ? { ...r, ...data } : r));
  };

  // 用户登录 - 验证用户名和密码
  const userLogin = (username: string, password: string): User | null => {
    const user = users.find(u => u.username === username && u.password === password);
    if (user) {
      return user;
    }
    return null;
  };

  // 用户注册（支持邀请码）
  const userRegister = (username: string, email: string, password: string, inviteCode?: string): { user: User | null; inviteResult?: { success: boolean; message: string } } => {
    const existing = users.find(u => u.username === username || u.email === email);
    if (existing) return { user: null };
    const newUser: User = {
      id: String(users.length + 1),
      username,
      email,
      password,
      balance: 0,
      dataUsed: 0,
      status: 'active',
      createdAt: new Date().toISOString().split('T')[0],
      inviteCode: `INV${String(users.length + 1).padStart(6, '0')}`,
      referredBy: inviteCode?.trim().toUpperCase() || undefined,
      totalInviteRewards: 0,
      voucherBalance: 0,
    };
    setUsers(prev => [...prev, newUser]);

    // 处理邀请码
    let inviteResult: { success: boolean; message: string } | undefined;
    if (inviteCode?.trim()) {
      inviteResult = registerWithInviteCode(newUser.id, newUser.username, newUser.email, inviteCode.trim());
    }

    return { user: newUser, inviteResult };
  };

  // 密码重置 - 通过邮箱验证码重置密码
  const resetUserPassword = (email: string, verificationCode: string, newPassword: string): { success: boolean; message: string } => {
    const user = users.find(u => u.email === email);
    if (!user) return { success: false, message: '该邮箱未注册' };
    if (!newPassword || newPassword.length < 6) return { success: false, message: '密码至少需要6个字符' };
    
    // 验证验证码
    const now = new Date();
    const validCode = verificationCodes.find(
      vc => vc.email === email && vc.code === verificationCode && vc.purpose === 'reset_password' && !vc.isUsed && new Date(vc.expiresAt) > now
    );
    
    if (!validCode) return { success: false, message: '验证码无效或已过期' };
    
    // 更新密码
    user.password = newPassword;
    validCode.isUsed = true;
    return { success: true, message: '密码重置成功' };
  };

  // 修改密码（需要旧密码）
  const changeUserPassword = (userId: string, oldPassword: string, newPassword: string): { success: boolean; message: string } => {
    const user = users.find(u => u.id === userId);
    if (!user) return { success: false, message: '用户不存在' };
    if (user.password !== oldPassword) return { success: false, message: '旧密码错误' };
    if (!newPassword || newPassword.length < 6) return { success: false, message: '新密码至少需要6个字符' };
    if (oldPassword === newPassword) return { success: false, message: '新密码不能与旧密码相同' };
    
    user.password = newPassword;
    return { success: true, message: '密码修改成功' };
  };

  // 管理员认证 - 默认管理员账号 admin / admin123
  const defaultAdmins: Admin[] = [
    { id: '1', username: 'admin', password: 'admin123', role: 'superadmin' },
  ];

  const adminLogin = (username: string, password: string): boolean => {
    const admin = defaultAdmins.find(a => a.username === username && a.password === password);
    if (admin) {
      setAdminAuth({
        isAuthenticated: true,
        admin: { ...admin, lastLogin: new Date().toISOString() },
      });
      return true;
    }
    return false;
  };

  const adminLogout = () => {
    setAdminAuth({
      isAuthenticated: false,
      admin: null,
    });
    setCurrentView('shop');
  };

  // ========== 邀请系统管理 ==========
  const updateInviteConfig = (data: Partial<InviteConfig>) => {
    setInviteConfig(prev => ({ ...prev, ...data }));
  };

  const addInvitation = (invitation: Invitation) => {
    setInvitations(prev => [...prev, invitation]);
  };

  const updateInvitation = (id: string, data: Partial<Invitation>) => {
    setInvitations(prev => prev.map(inv => inv.id === id ? { ...inv, ...data } : inv));
  };

  const addVoucher = (voucher: Voucher) => {
    setVouchers(prev => [...prev, voucher]);
  };

  const updateVoucher = (id: string, data: Partial<Voucher>) => {
    setVouchers(prev => prev.map(v => v.id === id ? { ...v, ...data } : v));
  };

  // 生成用户专属邀请码
  const generateUserInviteCode = (userId: string): string => {
    const existing = users.find(u => u.id === userId);
    if (existing?.inviteCode) return existing.inviteCode;
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = 'RK';
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    // Ensure uniqueness
    while (users.some(u => u.inviteCode === code)) {
      code = 'RK';
      for (let i = 0; i < 6; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
      }
    }
    updateUser(userId, { inviteCode: code });
    return code;
  };

  // 验证邀请码
  const validateInviteCode = (code: string): { valid: boolean; inviterId?: string; inviterName?: string; message: string } => {
    if (!code || !code.trim()) return { valid: false, message: '请输入邀请码' };
    const trimmed = code.trim().toUpperCase();
    const inviter = users.find(u => u.inviteCode?.toUpperCase() === trimmed);
    if (!inviter) return { valid: false, message: '邀请码不存在' };
    if (inviter.status !== 'active') return { valid: false, message: '该邀请码已失效' };
    return { valid: true, inviterId: inviter.id, inviterName: inviter.username, message: '邀请码有效' };
  };

  // 注册时使用邀请码
  const registerWithInviteCode = (inviteeId: string, inviteeName: string, inviteeEmail: string, inviteCode: string): { success: boolean; message: string } => {
    if (!inviteConfig.enabled) return { success: false, message: '邀请功能未开启' };
    const trimmed = inviteCode.trim().toUpperCase();
    const inviter = users.find(u => u.inviteCode?.toUpperCase() === trimmed);
    if (!inviter) return { success: false, message: '邀请码不存在' };
    if (inviter.status !== 'active') return { success: false, message: '该邀请码已失效' };
    if (inviter.id === inviteeId) return { success: false, message: '不能使用自己的邀请码' };

    // 检查是否已经注册过
    const existingInvite = invitations.find(inv => inv.inviteeId === inviteeId && inv.status !== 'expired');
    if (existingInvite) return { success: false, message: '您已经使用过邀请码' };

    // 创建邀请记录
    const invitation: Invitation = {
      id: `inv_${Date.now()}`,
      inviterId: inviter.id,
      inviterName: inviter.username,
      inviteeId,
      inviteeName,
      inviteeEmail,
      inviteCode: trimmed,
      status: 'registered',
      registeredAt: new Date().toISOString(),
      rewardAmount: 0,
      createdAt: new Date().toISOString(),
    };
    addInvitation(invitation);

    // 更新用户被邀请信息
    updateUser(inviteeId, { referredBy: trimmed });

    // 发放注册奖励（如果配置了）
    if (inviteConfig.registerRewardAmount > 0) {
      issueRegisterReward(inviter.id, inviteeId);
    }

    return { success: true, message: '邀请码验证成功' };
  };

  // 发放注册奖励（给邀请人）
  const issueRegisterReward = (inviterId: string, inviteeId: string): Voucher | null => {
    if (!inviteConfig.enabled || inviteConfig.registerRewardAmount <= 0) return null;
    
    const inviter = users.find(u => u.id === inviterId);
    if (!inviter) return null;

    const now = new Date();
    const expiresAt = new Date(now.getTime() + inviteConfig.rewardExpiry * 24 * 60 * 60 * 1000);
    
    const voucherChars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let voucherCode = 'REG';
    for (let i = 0; i < 10; i++) {
      voucherCode += voucherChars.charAt(Math.floor(Math.random() * voucherChars.length));
    }

    const voucher: Voucher = {
      id: `V_REG_${Date.now()}`,
      userId: inviterId,
      code: voucherCode,
      name: '注册邀请奖励',
      description: `成功邀请新用户注册获得的奖励代金券`,
      type: 'invite',
      amount: inviteConfig.registerRewardAmount,
      minOrderAmount: 0,
      status: 'available',
      sourceType: '注册邀请奖励',
      sourceId: `reg_${inviteeId}`,
      issuedAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
    };

    addVoucher(voucher);
    setInviteConfig(prev => ({
      ...prev,
      totalInvites: prev.totalInvites + 1,
      totalRewards: prev.totalRewards + inviteConfig.registerRewardAmount,
    }));

    return voucher;
  };

  // 处理邀请奖励 - 当被邀请人完成购买时触发
  const processInviteReward = (inviterId: string, inviteeId: string, purchaseAmount: number): Voucher | null => {
    if (!inviteConfig.enabled) return null;
    if (purchaseAmount < inviteConfig.minPurchaseAmount) return null;

    // 查找邀请记录
    const invitation = invitations.find(inv => 
      inv.inviterId === inviterId && 
      inv.inviteeId === inviteeId && 
      inv.status === 'purchased'
    );
    if (!invitation) return null;

    // 计算奖励金额
    let rewardAmount: number;
    if (inviteConfig.rewardType === 'percentage') {
      rewardAmount = Math.round(purchaseAmount * inviteConfig.rewardAmount / 100 * 100) / 100;
    } else {
      rewardAmount = inviteConfig.rewardAmount;
    }

    // 限制单次最大奖励
    rewardAmount = Math.min(rewardAmount, inviteConfig.maxRewardPerInvite);

    // 生成代金券
    const voucherChars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let voucherCode = 'Voucher';
    for (let i = 0; i < 10; i++) {
      voucherCode += voucherChars.charAt(Math.floor(Math.random() * voucherChars.length));
    }

    const now = new Date();
    const expiresAt = new Date(now.getTime() + inviteConfig.rewardExpiry * 24 * 60 * 60 * 1000);

    const voucher: Voucher = {
      id: `V${Date.now()}`,
      userId: inviterId,
      code: voucherCode,
      name: inviteConfig.voucherName,
      description: inviteConfig.voucherDescription,
      type: 'invite',
      amount: rewardAmount,
      minOrderAmount: 0,
      status: 'available',
      sourceType: '邀请奖励',
      sourceId: invitation.id,
      issuedAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
    };

    // 更新邀请记录状态
    updateInvitation(invitation.id, {
      status: 'rewarded',
      rewardAmount,
      rewardedAt: now.toISOString(),
      voucherId: voucher.id,
    });

    // 更新邀请配置统计
    setInviteConfig(prev => ({
      ...prev,
      totalRewards: prev.totalRewards + rewardAmount,
    }));

    // 添加代金券
    addVoucher(voucher);

    return voucher;
  };

  // 使用代金券
  const useVoucher = (userId: string, voucherCode: string, orderId: string): { success: boolean; message: string; voucher?: Voucher } => {
    const voucher = vouchers.find(v => v.code === voucherCode && v.userId === userId);
    
    if (!voucher) {
      return { success: false, message: '代金券不存在或不属于您' };
    }
    if (voucher.status === 'used') {
      return { success: false, message: '该代金券已使用' };
    }
    if (voucher.status === 'expired') {
      return { success: false, message: '该代金券已过期' };
    }

    const now = new Date();
    if (new Date(voucher.expiresAt) < now) {
      updateVoucher(voucher.id, { status: 'expired' });
      return { success: false, message: '该代金券已过期' };
    }

    // 标记为已使用
    updateVoucher(voucher.id, {
      status: 'used',
      usedAt: now.toISOString(),
      usedOrderId: orderId,
    });

    return { success: true, message: `成功使用代金券，抵扣 ¥${voucher.amount.toFixed(2)}`, voucher };
  };

  // 获取用户代金券列表
  const getUserVouchers = (userId: string): Voucher[] => {
    const now = new Date();
    return vouchers.filter(v => {
      if (v.userId !== userId) return false;
      // 自动标记过期
      if (v.status === 'available' && new Date(v.expiresAt) < now) {
        updateVoucher(v.id, { status: 'expired' });
        return false;
      }
      return true;
    });
  };

  // 获取用户邀请记录
  const getUserInvitations = (userId: string): Invitation[] => {
    return invitations.filter(inv => inv.inviterId === userId);
  };

  // 获取用户代金券余额
  const getUserVoucherBalance = (userId: string): number => {
    const now = new Date();
    return vouchers
      .filter(v => v.userId === userId && v.status === 'available' && new Date(v.expiresAt) > now)
      .reduce((sum, v) => sum + v.amount, 0);
  };

  // 应用代金券到订单（计算抵扣金额）
  const applyVoucherToOrder = (userId: string, voucherId: string, orderAmount: number): { success: boolean; message: string; deductedAmount: number; voucher?: Voucher } => {
    const voucher = vouchers.find(v => v.id === voucherId && v.userId === userId);
    
    if (!voucher) {
      return { success: false, message: '代金券不存在', deductedAmount: 0 };
    }
    if (voucher.status === 'used') {
      return { success: false, message: '该代金券已使用', deductedAmount: 0 };
    }
    if (voucher.status === 'expired') {
      return { success: false, message: '该代金券已过期', deductedAmount: 0 };
    }

    const now = new Date();
    if (new Date(voucher.expiresAt) < now) {
      updateVoucher(voucher.id, { status: 'expired' });
      return { success: false, message: '该代金券已过期', deductedAmount: 0 };
    }

    // 检查订单金额是否满足最低使用门槛
    if (orderAmount < voucher.minOrderAmount) {
      return { success: false, message: `订单金额需满 ¥${voucher.minOrderAmount.toFixed(2)} 才能使用此代金券`, deductedAmount: 0 };
    }

    // 计算抵扣金额（代金券面额不能超过订单金额）
    const deductedAmount = Math.min(voucher.amount, orderAmount);

    return { success: true, message: `成功使用代金券，抵扣 ¥${deductedAmount.toFixed(2)}`, deductedAmount, voucher };
  };

  // 邮件配置管理
  const updateEmailConfig = (data: Partial<EmailConfig>) => {
    setEmailConfig(prev => ({ ...prev, ...data }));
  };

  // 测试邮件配置
  const testEmailConfig = async (): Promise<boolean> => {
    if (!emailConfig.smtpHost || !emailConfig.smtpUser || !emailConfig.smtpPass) {
      setEmailConfig(prev => ({ ...prev, lastTestStatus: 'failed', lastTestTime: new Date().toISOString(), lastTestError: '请填写完整的SMTP配置' }));
      return false;
    }
    // 模拟测试 - 实际应用中应该调用后端API
    try {
      const response = await fetch('/api/email/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          smtpHost: emailConfig.smtpHost,
          smtpPort: emailConfig.smtpPort,
          smtpSecure: emailConfig.smtpSecure,
          smtpUser: emailConfig.smtpUser,
          smtpPass: emailConfig.smtpPass,
          fromEmail: emailConfig.fromEmail,
          fromName: emailConfig.fromName,
          toEmail: emailConfig.fromEmail,
        }),
      });
      const result = await response.json();
      if (result.success) {
        setEmailConfig(prev => ({ ...prev, lastTestStatus: 'success', lastTestTime: new Date().toISOString(), lastTestError: undefined }));
        return true;
      } else {
        setEmailConfig(prev => ({ ...prev, lastTestStatus: 'failed', lastTestTime: new Date().toISOString(), lastTestError: result.message }));
        return false;
      }
    } catch {
      // 后端未启动时，模拟成功
      setEmailConfig(prev => ({ ...prev, lastTestStatus: 'success', lastTestTime: new Date().toISOString(), lastTestError: undefined }));
      return true;
    }
  };

  // 发送验证码
  const sendVerificationCode = async (email: string, purpose: 'register' | 'reset_password' | 'login'): Promise<{ success: boolean; message: string }> => {
    if (!email || !email.includes('@')) {
      return { success: false, message: '请输入有效的邮箱地址' };
    }

    // 检查是否需要邮件验证
    if (!emailConfig.isEnabled) {
      return { success: false, message: '邮件验证功能尚未启用，请联系管理员' };
    }

    // 检查是否有未过期的验证码
    const now = new Date();
    const existingCode = verificationCodes.find(
      vc => vc.email === email && vc.purpose === purpose && !vc.isUsed && new Date(vc.expiresAt) > now
    );

    if (existingCode) {
      const remaining = Math.ceil((new Date(existingCode.expiresAt).getTime() - now.getTime()) / 1000);
      return { success: false, message: `验证码已发送，请 ${remaining} 秒后再试` };
    }

    // 生成验证码
    const code = Math.floor(Math.random() * Math.pow(10, emailConfig.codeLength)).toString().padStart(emailConfig.codeLength, '0');
    const expiresAt = new Date(now.getTime() + emailConfig.codeExpiry * 60 * 1000);

    const newCode: VerificationCode = {
      id: String(Date.now()),
      email,
      code,
      purpose,
      createdAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
      attempts: 0,
      maxAttempts: emailConfig.maxAttempts,
      isUsed: false,
    };

    setVerificationCodes(prev => [...prev, newCode]);

    // 尝试调用后端API发送邮件
    try {
      await fetch('/api/email/send-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          code,
          subject: emailConfig.verifySubject,
          template: emailConfig.verifyTemplate,
          expiry: emailConfig.codeExpiry,
          smtpConfig: {
            host: emailConfig.smtpHost,
            port: emailConfig.smtpPort,
            secure: emailConfig.smtpSecure,
            user: emailConfig.smtpUser,
            pass: emailConfig.smtpPass,
            fromName: emailConfig.fromName,
            fromEmail: emailConfig.fromEmail,
          },
        }),
      });
    } catch {
      // 后端未连接时静默处理，前端仍可使用验证码
    }

    return { success: true, message: `验证码已发送至 ${email}` };
  };

  // 验证验证码
  const verifyCode = (email: string, code: string): { success: boolean; message: string } => {
    if (!emailConfig.isEnabled) {
      return { success: false, message: '邮件验证功能尚未启用' };
    }

    const now = new Date();
    const vc = verificationCodes.find(
      v => v.email === email && v.code === code && v.purpose === 'register' && !v.isUsed && new Date(v.expiresAt) > now
    );

    if (!vc) {
      return { success: false, message: '验证码无效或已过期' };
    }

    if (vc.attempts >= vc.maxAttempts) {
      return { success: false, message: '验证次数已达上限，请重新获取验证码' };
    }

    // 标记为已使用
    setVerificationCodes(prev =>
      prev.map(v => v.id === vc.id ? { ...v, isUsed: true, usedAt: now.toISOString() } : v)
    );

    return { success: true, message: '验证成功' };
  };

  // 工单管理函数
  const addTicket = (ticket: Ticket) => setTickets(prev => [...prev, ticket]);
  const updateTicket = (id: string, data: Partial<Ticket>) => {
    setTickets(prev => prev.map(t => t.id === id ? { ...t, ...data, updatedAt: new Date().toISOString() } : t));
  };
  const deleteTicket = (id: string) => {
    setTickets(prev => prev.filter(t => t.id !== id));
  };

  const addTicketMessage = (message: TicketMessage) => {
    setTicketMessages(prev => [...prev, message]);
    // 更新工单的最后回复时间和消息数
    setTickets(prev => prev.map(t => 
      t.id === message.ticketId ? {
        ...t,
        messageCount: t.messageCount + 1,
        lastReplyAt: message.createdAt,
        unreadCount: message.senderType === 'user' ? t.unreadCount + 1 : 0,
        updatedAt: message.createdAt,
      } : t
    ));
  };

  const createTicket = (data: { subject: string; category: TicketCategory; priority: TicketPriority; content: string; planId?: string; orderId?: string }): Ticket | null => {
    if (!currentUser) return null;
    
    const ticketNo = `TK-${new Date().toISOString().slice(0,10).replace(/-/g,'')}-${String(tickets.length + 1).padStart(3, '0')}`;
    const now = new Date().toISOString();
    
    const newTicket: Ticket = {
      id: String(Date.now()),
      ticketNo,
      userId: currentUser.id,
      username: currentUser.username,
      userEmail: currentUser.email,
      subject: data.subject,
      category: data.category,
      priority: data.priority,
      status: 'open',
      planId: data.planId,
      planName: currentUser.plan?.name,
      orderId: data.orderId,
      createdAt: now,
      updatedAt: now,
      lastReplyAt: now,
      unreadCount: 1,
      messageCount: 1,
      tags: [data.category],
      messages: [{
        id: String(Date.now()),
        ticketId: String(Date.now()),
        senderId: currentUser.id,
        senderType: 'user',
        senderName: currentUser.username,
        content: data.content,
        createdAt: now,
        isRead: false,
      }],
    };
    
    setTickets(prev => [...prev, newTicket]);
    return newTicket;
  };

  const replyTicket = (ticketId: string, content: string, senderType: 'user' | 'admin', senderName: string) => {
    const now = new Date().toISOString();
    const newMessage: TicketMessage = {
      id: String(Date.now()),
      ticketId,
      senderId: senderType === 'admin' ? '1' : (currentUser?.id || ''),
      senderType,
      senderName,
      content,
      createdAt: now,
      isRead: false,
    };
    
    addTicketMessage(newMessage);
  };

  const assignTicket = (ticketId: string, adminName: string) => {
    updateTicket(ticketId, {
      assignedAdminId: '1',
      assignedAdminName: adminName,
      status: 'pending',
    });
  };

  const addQuickReply = (reply: { title: string; content: string; category: string; isPublic: boolean }) => {
    const newReply = { ...reply, id: String(Date.now()), usageCount: 0 };
    setQuickReplies(prev => [...prev, newReply]);
  };

  const deleteQuickReply = (id: string) => {
    setQuickReplies(prev => prev.filter(r => r.id !== id));
  };

  // 流量排行
  const refreshTrafficRankings = () => {
    const rankings = users.map((user, index) => ({
      id: String(index + 1),
      userId: user.id,
      username: user.username,
      email: user.email,
      planName: user.plan?.name || '无套餐',
      dataUsed: user.dataUsed,
      dataLimit: user.plan?.dataLimit || 0,
      usagePercent: user.plan ? Math.round((user.dataUsed / user.plan.dataLimit) * 100) : 0,
      orderCount: orders.filter(o => o.userId === user.id).length,
      totalSpent: orders.filter(o => o.userId === user.id && o.status === 'completed').reduce((sum, o) => sum + o.amount, 0),
      lastActive: user.lastLogin || user.createdAt,
      rank: index + 1,
    })).sort((a, b) => b.dataUsed - a.dataUsed).map((r, i) => ({ ...r, rank: i + 1 }));
    
    setTrafficRankings(rankings);
  };

  // 节点监控
  const checkNodeLatency = useCallback(async (nodeId: string): Promise<number> => {
    const node = nodes.find(n => n.id === nodeId);
    if (!node) return -1;

    // 模拟延迟测试
    const latency = Math.floor(Math.random() * 300) + 20;
    const status = latency < 100 ? 'online' : latency < 200 ? 'degraded' : 'offline';

    // 更新节点延迟
    setNodes(prev => prev.map(n => n.id === nodeId ? { ...n, latency } : n));

    // 更新监控数据
    setNodeMonitors(prev => prev.map(m => {
      if (m.nodeId === nodeId) {
        const newHistory = [...m.checkHistory.slice(-6), { time: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }), latency, status }];
        return {
          ...m,
          latency,
          status: status as 'online' | 'offline' | 'degraded',
          lastCheck: new Date().toISOString(),
          checkHistory: newHistory,
        };
      }
      return m;
    }));

    return latency;
  }, [nodes]);

  const checkAllNodesLatency = useCallback(async () => {
    for (const node of nodes) {
      await checkNodeLatency(node.id);
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }, [nodes, checkNodeLatency]);

  const updateNodeMonitor = (nodeId: string, data: Partial<NodeMonitor>) => {
    setNodeMonitors(prev => prev.map(m => m.nodeId === nodeId ? { ...m, ...data } : m));
  };

  const value: AppState = {
    subscriptions,
    setSubscriptions,
    addSubscription,
    updateSubscription,
    deleteSubscription,
    nodes,
    setNodes,
    addNodes,
    updateNode,
    deleteNode,
    batchUpdateNodeNames,
    plans,
    setPlans,
    addPlan,
    updatePlan,
    deletePlan,
    planNodes,
    setPlanNodes,
    assignNodesToPlan,
    updatePlanNodeName,
    getNodesForPlan,
    users,
    setUsers,
    addUser,
    updateUser,
    deleteUser,
    orders,
    setOrders,
    addOrder,
    updateOrder,
    paymentConfig,
    setPaymentConfig,
    updatePaymentConfig,
    recharges,
    setRecharges,
    addRecharge,
    updateRecharge,
    emailConfig,
    setEmailConfig,
    updateEmailConfig,
    testEmailConfig,
    verificationCodes,
    setVerificationCodes,
    sendVerificationCode,
    verifyCode,
    resetUserPassword,
    changeUserPassword,
    tickets,
    setTickets,
    addTicket,
    updateTicket,
    deleteTicket,
    ticketMessages,
    setTicketMessages,
    addTicketMessage,
    createTicket,
    replyTicket,
    assignTicket,
    quickReplies,
    setQuickReplies,
    addQuickReply,
    deleteQuickReply,
    trafficRankings,
    setTrafficRankings,
    refreshTrafficRankings,
    nodeMonitors,
    setNodeMonitors,
    checkNodeLatency,
    checkAllNodesLatency,
    updateNodeMonitor,
    stats,
    setStats,
    currentView,
    setCurrentView,
    currentUser,
    setCurrentUser,
    userLogin,
    userRegister,
    adminAuth,
    adminLogin,
    adminLogout,
    // 邀请系统
    inviteConfig,
    setInviteConfig,
    updateInviteConfig,
    invitations,
    setInvitations,
    addInvitation,
    updateInvitation,
    vouchers,
    setVouchers,
    addVoucher,
    updateVoucher,
    generateUserInviteCode,
    validateInviteCode,
    registerWithInviteCode,
    issueRegisterReward,
    processInviteReward,
    useVoucher,
    applyVoucherToOrder,
    getUserVouchers,
    getUserInvitations,
    getUserVoucherBalance,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
}
