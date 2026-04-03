/**
 * API 客户端 - 与后端服务通信
 */
const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:3000/api';

interface ApiResponse<T = any> {
  success: boolean;
  message?: string;
  data?: T;
  errors?: any[];
  pagination?: { page: number; limit: number; total: number };
}

async function request<T = any>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  const url = `${API_BASE}${endpoint}`;
  
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };

  // 添加认证令牌
  const token = localStorage.getItem('auth_token');
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  try {
    const response = await fetch(url, {
      ...options,
      headers,
    });

    const data = await response.json();

    if (!response.ok) {
      if (response.status === 401) {
        localStorage.removeItem('auth_token');
        localStorage.removeItem('user');
        localStorage.removeItem('admin');
      }
      return {
        success: false,
        message: data.message || '请求失败',
        errors: data.errors,
      };
    }

    return data;
  } catch (error: any) {
    return {
      success: false,
      message: error.message || '网络错误，请检查后端服务是否运行',
    };
  }
}

// ============ 认证 API ============
export const authApi = {
  register: (data: { username: string; email: string; password: string; verificationCode?: string }) =>
    request('/auth/register', { method: 'POST', body: JSON.stringify(data) }),

  login: (data: { username: string; password: string }) =>
    request('/auth/login', { method: 'POST', body: JSON.stringify(data) }),

  adminLogin: (data: { username: string; password: string }) =>
    request('/auth/admin/login', { method: 'POST', body: JSON.stringify(data) }),

  me: () => request('/auth/me'),
};

// ============ 用户 API ============
export const userApi = {
  profile: () => request('/user/profile'),
  orders: () => request('/user/orders'),
  nodes: () => request('/user/nodes'),
  createOrder: (data: { planId: string; paymentMethod: string }) =>
    request('/user/order', { method: 'POST', body: JSON.stringify(data) }),
  updateProfile: (data: { username?: string; email?: string }) =>
    request('/user/profile', { method: 'PUT', body: JSON.stringify(data) }),
  changePassword: (data: { oldPassword: string; newPassword: string }) =>
    request('/user/password', { method: 'PUT', body: JSON.stringify(data) }),
};

// ============ 管理 API ============
export const adminApi = {
  dashboard: () => request('/admin/dashboard'),
  
  // 订阅源
  getSubscriptions: () => request('/admin/subscriptions'),
  createSubscription: (data: { name: string; url: string; source?: string }) =>
    request('/admin/subscriptions', { method: 'POST', body: JSON.stringify(data) }),
  updateSubscription: (id: string, data: any) =>
    request(`/admin/subscriptions/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteSubscription: (id: string) =>
    request(`/admin/subscriptions/${id}`, { method: 'DELETE' }),

  // 节点
  getNodes: () => request('/admin/nodes'),
  createNode: (data: any) =>
    request('/admin/nodes', { method: 'POST', body: JSON.stringify(data) }),
  updateNode: (id: string, data: any) =>
    request(`/admin/nodes/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteNode: (id: string) =>
    request(`/admin/nodes/${id}`, { method: 'DELETE' }),

  // 套餐
  getPlans: () => request('/admin/plans'),
  createPlan: (data: any) =>
    request('/admin/plans', { method: 'POST', body: JSON.stringify(data) }),
  updatePlan: (id: string, data: any) =>
    request(`/admin/plans/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deletePlan: (id: string) =>
    request(`/admin/plans/${id}`, { method: 'DELETE' }),

  // 节点分配
  assignNodes: (data: { planId: string; nodeIds: string[] }) =>
    request('/admin/plan-nodes/assign', { method: 'POST', body: JSON.stringify(data) }),
  updatePlanNode: (planId: string, nodeId: string, data: { customName?: string; priority?: number }) =>
    request(`/admin/plan-nodes/${planId}/${nodeId}`, { method: 'PUT', body: JSON.stringify(data) }),

  // 用户
  getUsers: () => request('/admin/users'),
  updateUser: (id: string, data: any) =>
    request(`/admin/users/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteUser: (id: string) =>
    request(`/admin/users/${id}`, { method: 'DELETE' }),

  // 订单
  getOrders: (params?: { page?: number; limit?: number; status?: string }) => {
    const qs = new URLSearchParams(params as any).toString();
    return request(`/admin/orders${qs ? `?${qs}` : ''}`);
  },
  updateOrder: (id: string, data: any) =>
    request(`/admin/orders/${id}`, { method: 'PUT', body: JSON.stringify(data) }),

  // 系统配置
  getConfig: () => request('/admin/config'),
  updateConfig: (data: Record<string, string>) =>
    request('/admin/config', { method: 'PUT', body: JSON.stringify(data) }),
};

// ============ 支付 API ============
export const paymentApi = {
  getConfig: () => request('/payment/config'),
  getUsdtRate: () => request('/payment/usdt/rate'),
  createAlipayOrder: (data: { orderNo: string; amount: number; subject: string }) =>
    request('/payment/alipay/create', { method: 'POST', body: JSON.stringify(data) }),
  createUsdtOrder: (data: { orderNo: string; amountUSD: number }) =>
    request('/payment/usdt/create', { method: 'POST', body: JSON.stringify(data) }),
  confirmUsdt: (data: { txHash: string; network: string; amount: string; orderNo: string }) =>
    request('/payment/usdt/callback', { method: 'POST', body: JSON.stringify(data) }),
  checkStatus: (orderNo: string) => request(`/payment/check/${orderNo}`),
};

// ============ 邮件 API ============
export const emailApi = {
  sendCode: (data: { email: string; purpose?: string }) =>
    request('/email/send-code', { method: 'POST', body: JSON.stringify(data) }),
  verifyCode: (data: { email: string; code: string; purpose?: string }) =>
    request('/email/verify-code', { method: 'POST', body: JSON.stringify(data) }),
  testConfig: (data: any) =>
    request('/email/test', { method: 'POST', body: JSON.stringify(data) }),
  getConfig: () => request('/email/config'),
  updateConfig: (data: any) =>
    request('/email/config', { method: 'PUT', body: JSON.stringify(data) }),
};

// ============ 工具函数 ============
export function getApiBase() {
  return API_BASE;
}

export function getSubscriptionUrl(token: string, target?: string) {
  const url = `${API_BASE.replace('/api', '')}/sub/${token}`;
  return target ? `${url}?target=${target}` : url;
}
