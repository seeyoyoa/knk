import { useState, useCallback, useMemo } from 'react';
import { useApp } from '../store';
import {
  convertSubscription,
  testLatencyBatch,
  downloadConfig,
  getProtocolIcon,
  type TargetPlatform,
} from '../utils/subscription';

type TabId = 'overview' | 'subscription' | 'nodes' | 'orders' | 'settings';

interface ClientInfo {
  id: TargetPlatform;
  name: string;
  icon: string;
  description: string;
  platforms: string;
  fileExt: string;
  fileName: string;
}

const CLIENTS: ClientInfo[] = [
  { id: 'Clash.Meta', name: 'Clash.Meta', icon: '⚡', description: 'mihomo 核心', platforms: 'Windows / Mac / Android', fileExt: 'yaml', fileName: 'clash-meta' },
  { id: 'V2Ray', name: 'V2Ray', icon: '🔷', description: 'V2RayN / V2RayNG', platforms: 'Windows / Android', fileExt: 'txt', fileName: 'v2ray-sub' },
  { id: 'sing-box', name: 'Sing-box', icon: '📦', description: '新一代代理核心', platforms: '全平台', fileExt: 'json', fileName: 'singbox-config' },
  { id: 'Shadowrocket', name: 'Shadowrocket', icon: '🚀', description: '小火箭 iOS', platforms: 'iOS', fileExt: 'txt', fileName: 'shadowrocket-sub' },
  { id: 'Surge', name: 'Surge', icon: '🌊', description: 'Surge 4/5', platforms: 'iOS / Mac', fileExt: 'conf', fileName: 'surge-config' },
  { id: 'QX', name: 'Quantumult X', icon: '✈️', description: '圈X', platforms: 'iOS', fileExt: 'conf', fileName: 'qx-config' },
  { id: 'Loon', name: 'Loon', icon: '🎈', description: 'Loon', platforms: 'iOS', fileExt: 'conf', fileName: 'loon-config' },
  { id: 'Stash', name: 'Stash', icon: '📱', description: '基于 Clash.Meta', platforms: 'iOS / Mac', fileExt: 'yaml', fileName: 'stash-config' },
];

export default function UserPanel() {
  const { currentUser, setCurrentUser, getNodesForPlan, setCurrentView, orders, plans, changeUserPassword } = useApp();
  const getPlanName = (planId: string) => plans.find(p => p.id === planId)?.name || '未知套餐';
  // Used for order display - plan lookup via plans.find
  void getPlanName;
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [selectedClient, setSelectedClient] = useState<TargetPlatform | null>(null);
  const [generatedContent, setGeneratedContent] = useState('');
  const [copiedClient, setCopiedClient] = useState<string | null>(null);
  const [latencyMap, setLatencyMap] = useState<Map<string, number>>(new Map());
  const [testingLatency, setTestingLatency] = useState(false);
  const [latencyProgress, setLatencyProgress] = useState(0);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [sortBy, setSortBy] = useState<'default' | 'latency' | 'name'>('default');

  // Password change state
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [passwordMessage, setPasswordMessage] = useState('');
  const [passwordMsgType, setPasswordMsgType] = useState<'success' | 'error'>('success');
  const [passwordStrength, setPasswordStrength] = useState(0);

  // Order filter
  const [orderFilter, setOrderFilter] = useState<'all' | 'completed' | 'pending' | 'cancelled'>('all');

  if (!currentUser) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--ios-bg)]">
        <div className="text-center p-8">
          <div className="text-5xl mb-4">👤</div>
          <p className="text-lg text-[var(--ios-secondary-label)] mb-4">请先登录</p>
          <button onClick={() => setCurrentView('shop')} className="ios-btn">
            返回商城
          </button>
        </div>
      </div>
    );
  }

  const userOrders = orders.filter(o => o.userId === currentUser.id);
  const filteredOrders = orderFilter === 'all' ? userOrders : userOrders.filter(o => o.status === orderFilter);
  const rawPlanNodes = currentUser.plan ? getNodesForPlan(currentUser.plan.id) : [];

  const processedNodes = useMemo(() => {
    let result = [...rawPlanNodes];
    result = result.map(node => ({
      ...node,
      latency: latencyMap.get(node.id) ?? node.latency,
    }));
    if (searchKeyword) {
      const keyword = searchKeyword.toLowerCase();
      result = result.filter(n =>
        (n.customName || n.name).toLowerCase().includes(keyword) ||
        n.server.toLowerCase().includes(keyword)
      );
    }
    if (sortBy === 'latency') {
      result.sort((a, b) => {
        const aLat = a.latency ?? Infinity;
        const bLat = b.latency ?? Infinity;
        return aLat - bLat;
      });
    } else if (sortBy === 'name') {
      result.sort((a, b) => (a.customName || a.name).localeCompare(b.customName || b.name, 'zh'));
    }
    return result;
  }, [rawPlanNodes, latencyMap, searchKeyword, sortBy]);

  const handleGenerateLink = useCallback((clientType: TargetPlatform) => {
    const content = convertSubscription(rawPlanNodes, clientType, currentUser.plan?.name || 'Subscription');
    setGeneratedContent(content);
    setSelectedClient(clientType);
  }, [rawPlanNodes, currentUser.plan]);

  const handleCopy = async (content: string, clientName: string) => {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedClient(clientName);
      setTimeout(() => setCopiedClient(null), 2000);
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = content;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopiedClient(clientName);
      setTimeout(() => setCopiedClient(null), 2000);
    }
  };

  const handleDownload = (clientType: TargetPlatform) => {
    const client = CLIENTS.find(c => c.id === clientType);
    if (!client) return;
    const content = convertSubscription(rawPlanNodes, clientType, currentUser.plan?.name || 'Subscription');
    downloadConfig(content, `${client.fileName}-${currentUser.id}.${client.fileExt}`);
  };

  const handleLatencyTest = async () => {
    if (rawPlanNodes.length === 0 || testingLatency) return;
    setTestingLatency(true);
    setLatencyProgress(0);
    try {
      const results = await testLatencyBatch(rawPlanNodes, () => {
        setLatencyProgress(prev => prev + 1);
      });
      setLatencyMap(results);
    } catch (error) {
      console.error('Latency test failed:', error);
    } finally {
      setTestingLatency(false);
    }
  };

  const handleSingleLatencyTest = async (nodeId: string) => {
    setLatencyMap(prev => new Map(prev).set(nodeId, -1));
    const latency = Math.floor(Math.random() * 280) + 30;
    await new Promise(resolve => setTimeout(resolve, 200 + Math.random() * 300));
    setLatencyMap(prev => new Map(prev).set(nodeId, latency));
  };

  const getLatencyColor = (latency: number | undefined): string => {
    if (latency === undefined || latency === -1) return 'var(--ios-secondary-label)';
    if (latency < 100) return 'var(--ios-green)';
    if (latency < 200) return 'var(--ios-blue)';
    if (latency < 300) return 'var(--ios-orange)';
    return 'var(--ios-red)';
  };

  const handleChangePassword = () => {
    setPasswordMessage('');
    setPasswordMsgType('success');
    if (!oldPassword) { setPasswordMessage('请输入旧密码'); setPasswordMsgType('error'); return; }
    if (!newPassword || newPassword.length < 6) { setPasswordMessage('新密码至少需要6个字符'); setPasswordMsgType('error'); return; }
    if (newPassword !== confirmNewPassword) { setPasswordMessage('两次输入的密码不一致'); setPasswordMsgType('error'); return; }
    
    const result = changeUserPassword(currentUser.id, oldPassword, newPassword);
    setPasswordMessage(result.message);
    setPasswordMsgType(result.success ? 'success' : 'error');
    if (result.success) {
      setOldPassword('');
      setNewPassword('');
      setConfirmNewPassword('');
    }
  };

  const dataPercent = currentUser.plan ? Math.min((currentUser.dataUsed / currentUser.plan.dataLimit) * 100, 100) : 0;
  const daysLeft = currentUser.planExpire ? Math.max(0, Math.ceil((new Date(currentUser.planExpire).getTime() - Date.now()) / 86400000)) : 0;

  const tabs = [
    { id: 'overview' as TabId, label: '概览', icon: '📊' },
    { id: 'subscription' as TabId, label: '订阅', icon: '🔗' },
    { id: 'nodes' as TabId, label: '节点', icon: '🖥️' },
    { id: 'orders' as TabId, label: '订单', icon: '📋' },
    { id: 'settings' as TabId, label: '设置', icon: '⚙️' },
  ];

  return (
    <div className="min-h-screen bg-[var(--ios-bg)] pb-24">
      {/* iOS Navigation Bar */}
      <nav className="ios-navbar">
        <div className="mx-auto max-w-5xl px-4 py-3 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <button onClick={() => setCurrentView('shop')} className="text-[var(--ios-blue)] text-sm font-medium">
              ← 商城
            </button>
            <span className="text-lg font-semibold text-[var(--ios-label)]">控制面板</span>
          </div>
          <div className="flex items-center space-x-3">
            <span className="text-sm text-[var(--ios-secondary-label)]">{currentUser.username}</span>
            <button onClick={() => { setCurrentUser(null); setCurrentView('shop'); }} className="text-sm text-[var(--ios-red)] font-medium">
              退出
            </button>
          </div>
        </div>
      </nav>

      {/* Large Title */}
      <div className="mx-auto max-w-5xl px-4 pt-4 pb-2">
        <h1 className="ios-large-title text-[var(--ios-label)]">我的账户</h1>
      </div>

      {/* Tab Bar */}
      <div className="mx-auto max-w-5xl px-4 mb-4">
        <div className="ios-segmented">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`ios-segmented-item ${activeTab === tab.id ? 'active' : ''}`}
            >
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-4">
        {/* ===== Overview Tab ===== */}
        {activeTab === 'overview' && (
          <div className="space-y-4 ios-fade-in">
            {/* Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="ios-card p-4">
                <p className="text-xs text-[var(--ios-secondary-label)] mb-1">当前套餐</p>
                <p className="font-semibold text-[var(--ios-label)]">{currentUser.plan?.name || '未订阅'}</p>
              </div>
              <div className="ios-card p-4">
                <p className="text-xs text-[var(--ios-secondary-label)] mb-1">剩余天数</p>
                <p className="font-semibold text-[var(--ios-label)]">{daysLeft} 天</p>
              </div>
              <div className="ios-card p-4">
                <p className="text-xs text-[var(--ios-secondary-label)] mb-1">可用节点</p>
                <p className="font-semibold text-[var(--ios-label)]">{rawPlanNodes.length} 个</p>
              </div>
              <div className="ios-card p-4">
                <p className="text-xs text-[var(--ios-secondary-label)] mb-1">账户状态</p>
                <p className={`font-semibold ${currentUser.status === 'active' ? 'text-[var(--ios-green)]' : 'text-[var(--ios-red)]'}`}>
                  {currentUser.status === 'active' ? '正常' : '已暂停'}
                </p>
              </div>
            </div>

            {/* Plan Details */}
            {currentUser.plan && (
              <div className="ios-card overflow-hidden">
                <div className="px-4 py-3 border-b border-[var(--ios-separator)]">
                  <h3 className="font-semibold text-[var(--ios-label)]">套餐详情</h3>
                </div>
                <div className="p-4 space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-[var(--ios-secondary-label)]">流量使用</span>
                    <span className="text-[var(--ios-label)] font-medium">{currentUser.dataUsed.toFixed(1)} / {currentUser.plan.dataLimit} GB</span>
                  </div>
                  <div className="ios-progress">
                    <div className="ios-progress-fill" style={{ width: `${dataPercent}%`, backgroundColor: dataPercent > 90 ? 'var(--ios-red)' : dataPercent > 70 ? 'var(--ios-orange)' : 'var(--ios-blue)' }} />
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-[var(--ios-secondary-label)]">到期时间</span>
                    <span className="text-[var(--ios-label)] font-medium">{currentUser.planExpire}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-[var(--ios-secondary-label)]">节点区域</span>
                    <span className="text-[var(--ios-label)] font-medium">{currentUser.plan.nodeGroups.join(', ')}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Quick Actions */}
            {currentUser.plan && rawPlanNodes.length > 0 && (
              <div className="ios-card overflow-hidden">
                <div className="px-4 py-3 border-b border-[var(--ios-separator)]">
                  <h3 className="font-semibold text-[var(--ios-label)]">快速操作</h3>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-[var(--ios-separator)]">
                  {[
                    { icon: '📋', label: '复制订阅', action: () => { handleGenerateLink('Clash.Meta'); setActiveTab('subscription'); } },
                    { icon: '⚡', label: '延迟测试', action: handleLatencyTest },
                    { icon: '📥', label: '下载配置', action: () => { handleDownload('Clash.Meta'); } },
                    { icon: '🔄', label: '续费升级', action: () => setCurrentView('shop') },
                  ].map((item, i) => (
                    <button key={i} onClick={item.action} className="bg-[var(--ios-card)] p-4 text-center active:bg-[var(--ios-fill)] transition-colors">
                      <div className="text-2xl mb-1">{item.icon}</div>
                      <div className="text-xs font-medium text-[var(--ios-label)]">{item.label}</div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Protocol Distribution */}
            {rawPlanNodes.length > 0 && (
              <div className="ios-card overflow-hidden">
                <div className="px-4 py-3 border-b border-[var(--ios-separator)]">
                  <h3 className="font-semibold text-[var(--ios-label)]">协议分布</h3>
                </div>
                <div className="grid grid-cols-3 md:grid-cols-6 gap-px bg-[var(--ios-separator)]">
                  {Array.from(new Set(rawPlanNodes.map(n => n.type))).map(proto => {
                    const count = rawPlanNodes.filter(n => n.type === proto).length;
                    return (
                      <div key={proto} className="bg-[var(--ios-card)] p-3 text-center">
                        <span className="text-xl">{getProtocolIcon(proto)}</span>
                        <p className="text-xs font-medium text-[var(--ios-label)] mt-1">{proto.toUpperCase()}</p>
                        <p className="text-[10px] text-[var(--ios-secondary-label)]">{count} 个</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ===== Subscription Tab ===== */}
        {activeTab === 'subscription' && (
          <div className="space-y-4 ios-fade-in">
            {currentUser.plan && rawPlanNodes.length > 0 ? (
              <>
                {/* Plan Info */}
                <div className="ios-card p-5">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h3 className="font-semibold text-[var(--ios-label)] text-lg">{currentUser.plan.name}</h3>
                      <p className="text-sm text-[var(--ios-secondary-label)]">¥{currentUser.plan.price}/{currentUser.plan.duration}天</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-[var(--ios-secondary-label)]">到期时间</p>
                      <p className="font-medium text-[var(--ios-label)]">{currentUser.planExpire}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="bg-[var(--ios-fill)] rounded-xl p-3 text-center">
                      <p className="text-xs text-[var(--ios-secondary-label)]">流量</p>
                      <p className="font-semibold text-[var(--ios-label)]">{currentUser.plan.dataLimit}GB</p>
                    </div>
                    <div className="bg-[var(--ios-fill)] rounded-xl p-3 text-center">
                      <p className="text-xs text-[var(--ios-secondary-label)]">节点</p>
                      <p className="font-semibold text-[var(--ios-label)]">{rawPlanNodes.length}个</p>
                    </div>
                    <div className="bg-[var(--ios-fill)] rounded-xl p-3 text-center">
                      <p className="text-xs text-[var(--ios-secondary-label)]">协议</p>
                      <p className="font-semibold text-[var(--ios-label)]">{Array.from(new Set(rawPlanNodes.map(n => n.type))).length}种</p>
                    </div>
                  </div>
                </div>

                {/* Client Selection */}
                <div className="ios-card overflow-hidden">
                  <div className="px-4 py-3 border-b border-[var(--ios-separator)]">
                    <h3 className="font-semibold text-[var(--ios-label)]">选择客户端</h3>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-[var(--ios-separator)]">
                    {CLIENTS.map((client) => (
                      <button
                        key={client.id}
                        onClick={() => handleGenerateLink(client.id)}
                        className={`bg-[var(--ios-card)] p-4 text-center transition-colors ${
                          selectedClient === client.id ? 'bg-[var(--ios-blue)]/10' : 'active:bg-[var(--ios-fill)]'
                        }`}
                      >
                        <div className="text-2xl mb-1">{client.icon}</div>
                        <div className="text-xs font-medium text-[var(--ios-label)]">{client.name}</div>
                        <div className="text-[10px] text-[var(--ios-secondary-label)] mt-0.5">{client.platforms}</div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Generated Content */}
                {selectedClient && generatedContent && (
                  <div className="ios-card overflow-hidden">
                    <div className="px-4 py-3 border-b border-[var(--ios-separator)] flex items-center justify-between">
                      <h3 className="font-semibold text-[var(--ios-label)]">
                        {CLIENTS.find(c => c.id === selectedClient)?.icon} {CLIENTS.find(c => c.id === selectedClient)?.name}
                      </h3>
                      <div className="flex space-x-2">
                        <button
                          onClick={() => handleCopy(generatedContent, selectedClient)}
                          className="text-sm text-[var(--ios-blue)] font-medium"
                        >
                          {copiedClient === selectedClient ? '✓ 已复制' : '复制'}
                        </button>
                        <button
                          onClick={() => handleDownload(selectedClient)}
                          className="text-sm text-[var(--ios-blue)] font-medium"
                        >
                          下载
                        </button>
                      </div>
                    </div>
                    <div className="p-4">
                      <pre className="text-xs text-[var(--ios-secondary-label)] bg-[var(--ios-fill)] rounded-xl p-4 overflow-x-auto max-h-48">
                        {generatedContent.slice(0, 500)}
                        {generatedContent.length > 500 ? '\n...' : ''}
                      </pre>
                    </div>
                  </div>
                )}

                {/* Usage Guide */}
                <div className="ios-card overflow-hidden">
                  <div className="px-4 py-3 border-b border-[var(--ios-separator)]">
                    <h3 className="font-semibold text-[var(--ios-label)]">使用说明</h3>
                  </div>
                  <div className="p-4 space-y-3 text-sm text-[var(--ios-secondary-label)]">
                    <div className="flex items-start space-x-3">
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--ios-blue)] text-white text-xs font-bold flex-shrink-0">1</span>
                      <p>选择上方对应的客户端类型</p>
                    </div>
                    <div className="flex items-start space-x-3">
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--ios-blue)] text-white text-xs font-bold flex-shrink-0">2</span>
                      <p>点击"复制"获取订阅链接，或"下载"获取配置文件</p>
                    </div>
                    <div className="flex items-start space-x-3">
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--ios-blue)] text-white text-xs font-bold flex-shrink-0">3</span>
                      <p>在客户端中导入订阅链接或配置文件即可使用</p>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="ios-empty">
                <div className="ios-empty-icon">📡</div>
                <p className="ios-empty-title">暂无订阅</p>
                <p className="ios-empty-desc">请先购买套餐以获取订阅</p>
                <button onClick={() => setCurrentView('shop')} className="ios-btn mt-4">前往购买</button>
              </div>
            )}
          </div>
        )}

        {/* ===== Nodes Tab ===== */}
        {activeTab === 'nodes' && (
          <div className="space-y-4 ios-fade-in">
            {/* Search & Sort */}
            <div className="ios-card overflow-hidden">
              <div className="p-3 space-y-2">
                <input
                  type="text"
                  placeholder="搜索节点..."
                  value={searchKeyword}
                  onChange={e => setSearchKeyword(e.target.value)}
                  className="ios-input"
                />
                <div className="flex items-center space-x-2">
                  <span className="text-xs text-[var(--ios-secondary-label)]">排序:</span>
                  <div className="ios-segmented flex-1">
                    {[
                      { value: 'default' as const, label: '默认' },
                      { value: 'latency' as const, label: '延迟' },
                      { value: 'name' as const, label: '名称' },
                    ].map(s => (
                      <button key={s.value} onClick={() => setSortBy(s.value)} className={`ios-segmented-item ${sortBy === s.value ? 'active' : ''}`}>
                        {s.label}
                      </button>
                    ))}
                  </div>
                  <button onClick={handleLatencyTest} disabled={testingLatency} className="ios-btn text-xs py-2 px-3 flex-shrink-0">
                    {testingLatency ? `测试中 ${latencyProgress}/${rawPlanNodes.length}` : '⚡ 测试延迟'}
                  </button>
                </div>
              </div>
            </div>

            {/* Node List */}
            {processedNodes.length > 0 ? (
              <div className="ios-card overflow-hidden">
                <div className="px-4 py-3 border-b border-[var(--ios-separator)] flex items-center justify-between">
                  <h3 className="font-semibold text-[var(--ios-label)]">节点列表 ({processedNodes.length})</h3>
                </div>
                <div className="divide-y divide-[var(--ios-separator)]">
                  {processedNodes.map((node) => {
                    const latency = latencyMap.get(node.id) ?? node.latency;
                    return (
                      <div key={node.id} className="ios-list-item">
                        <div className="ios-list-item-icon bg-[var(--ios-fill)]">
                          <span>{getProtocolIcon(node.type)}</span>
                        </div>
                        <div className="flex-1 ml-3 min-w-0">
                          <div className="font-medium text-[var(--ios-label)] truncate">{node.customName || node.name}</div>
                          <div className="text-xs text-[var(--ios-secondary-label)]">{node.server}:{node.port} · {node.countryCode}</div>
                        </div>
                        <div className="flex items-center space-x-2 ml-3 flex-shrink-0">
                          <span className="ios-badge" style={{ backgroundColor: `${getLatencyColor(latency)}15`, color: getLatencyColor(latency) }}>
                            {latency !== undefined && latency > 0 ? `${latency}ms` : '--'}
                          </span>
                          <button
                            onClick={() => handleSingleLatencyTest(node.id)}
                            className="text-xs text-[var(--ios-blue)] font-medium"
                          >
                            测试
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="ios-empty">
                <div className="ios-empty-icon">🖥️</div>
                <p className="ios-empty-title">暂无节点</p>
                <p className="ios-empty-desc">购买套餐后即可查看可用节点</p>
              </div>
            )}
          </div>
        )}

        {/* ===== Orders Tab ===== */}
        {activeTab === 'orders' && (
          <div className="space-y-4 ios-fade-in">
            {/* Order Summary */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="ios-card p-4 text-center">
                <p className="text-2xl font-bold text-[var(--ios-label)]">{userOrders.length}</p>
                <p className="text-xs text-[var(--ios-secondary-label)] mt-1">总订单</p>
              </div>
              <div className="ios-card p-4 text-center">
                <p className="text-2xl font-bold text-[var(--ios-green)]">{userOrders.filter(o => o.status === 'completed').length}</p>
                <p className="text-xs text-[var(--ios-secondary-label)] mt-1">已完成</p>
              </div>
              <div className="ios-card p-4 text-center">
                <p className="text-2xl font-bold text-[var(--ios-orange)]">{userOrders.filter(o => o.status === 'pending').length}</p>
                <p className="text-xs text-[var(--ios-secondary-label)] mt-1">待支付</p>
              </div>
              <div className="ios-card p-4 text-center">
                <p className="text-2xl font-bold text-[var(--ios-label)]">¥{userOrders.filter(o => o.status === 'completed').reduce((s, o) => s + o.amount, 0).toFixed(1)}</p>
                <p className="text-xs text-[var(--ios-secondary-label)] mt-1">总消费</p>
              </div>
            </div>

            {/* Filter */}
            <div className="ios-segmented">
              {[
                { value: 'all' as const, label: '全部' },
                { value: 'completed' as const, label: '已完成' },
                { value: 'pending' as const, label: '待支付' },
                { value: 'cancelled' as const, label: '已取消' },
              ].map(f => (
                <button key={f.value} onClick={() => setOrderFilter(f.value)} className={`ios-segmented-item ${orderFilter === f.value ? 'active' : ''}`}>
                  {f.label}
                </button>
              ))}
            </div>

            {/* Order List */}
            {filteredOrders.length > 0 ? (
              <div className="space-y-3">
                {filteredOrders.map((order) => {
                  const plan = plans.find(p => p.id === order.planId);
                  const statusConfig = {
                    completed: { label: '已完成', color: 'var(--ios-green)', bg: 'var(--ios-green)/15', icon: '✅' },
                    pending: { label: '待支付', color: 'var(--ios-orange)', bg: 'var(--ios-orange)/15', icon: '⏳' },
                    cancelled: { label: '已取消', color: 'var(--ios-red)', bg: 'var(--ios-red)/15', icon: '❌' },
                  };
                  const sc = statusConfig[order.status as keyof typeof statusConfig] || statusConfig.cancelled;
                  return (
                    <div key={order.id} className="ios-card overflow-hidden">
                      <div className="px-4 py-3 border-b border-[var(--ios-separator)] flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <span className="text-sm">📦</span>
                          <span className="font-medium text-[var(--ios-label)] text-sm">订单 #{order.id.padStart(6, '0')}</span>
                        </div>
                        <span className="ios-badge" style={{ backgroundColor: sc.bg, color: sc.color }}>
                          {sc.icon} {sc.label}
                        </span>
                      </div>
                      <div className="p-4">
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <h4 className="font-semibold text-[var(--ios-label)]">{plan?.name || '未知套餐'}</h4>
                            <p className="text-xs text-[var(--ios-secondary-label)] mt-0.5">
                              {plan?.dataLimit}GB · {plan?.duration}天 · {plan?.speedLimit}Mbps
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-xl font-bold text-[var(--ios-label)]">¥{order.amount}</p>
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-2 text-xs text-[var(--ios-secondary-label)]">
                          <div className="flex items-center space-x-1">
                            <span>💳</span>
                            <span>{order.paymentMethod || '支付宝'}</span>
                          </div>
                          <div className="flex items-center space-x-1">
                            <span>📅</span>
                            <span>创建: {order.createdAt}</span>
                          </div>
                          {order.paidAt && (
                            <div className="flex items-center space-x-1">
                              <span>✅</span>
                              <span>支付: {order.paidAt}</span>
                            </div>
                          )}
                        </div>
                      </div>
                      {order.status === 'pending' && (
                        <div className="px-4 py-3 border-t border-[var(--ios-separator)] flex justify-end space-x-2">
                          <button className="text-sm text-[var(--ios-secondary-label)] font-medium">取消订单</button>
                          <button className="ios-btn text-sm py-1.5 px-4">继续支付</button>
                        </div>
                      )}
                      {order.status === 'completed' && (
                        <div className="px-4 py-3 border-t border-[var(--ios-separator)] flex justify-end">
                          <button onClick={() => setActiveTab('subscription')} className="text-sm text-[var(--ios-blue)] font-medium">
                            查看订阅 →
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="ios-empty">
                <div className="ios-empty-icon">📋</div>
                <p className="ios-empty-title">暂无订单</p>
                <p className="ios-empty-desc">
                  {orderFilter !== 'all' ? '该筛选条件下没有订单' : '购买套餐后订单将显示在这里'}
                </p>
                {orderFilter === 'all' && (
                  <button onClick={() => setCurrentView('shop')} className="ios-btn mt-4">前往购买</button>
                )}
              </div>
            )}
          </div>
        )}

        {/* ===== Settings Tab ===== */}
        {activeTab === 'settings' && (
          <div className="space-y-4 ios-fade-in">
            {/* Account Info */}
            <div className="ios-card overflow-hidden">
              <div className="px-4 py-3 border-b border-[var(--ios-separator)]">
                <h3 className="font-semibold text-[var(--ios-label)]">账户信息</h3>
              </div>
              <div className="divide-y divide-[var(--ios-separator)]">
                <div className="ios-list-item">
                  <div className="flex-1">
                    <p className="text-xs text-[var(--ios-secondary-label)]">用户名</p>
                    <p className="font-medium text-[var(--ios-label)]">{currentUser.username}</p>
                  </div>
                </div>
                <div className="ios-list-item">
                  <div className="flex-1">
                    <p className="text-xs text-[var(--ios-secondary-label)]">邮箱</p>
                    <p className="font-medium text-[var(--ios-label)]">{currentUser.email}</p>
                  </div>
                </div>
                <div className="ios-list-item">
                  <div className="flex-1">
                    <p className="text-xs text-[var(--ios-secondary-label)]">注册时间</p>
                    <p className="font-medium text-[var(--ios-label)]">{currentUser.createdAt}</p>
                  </div>
                </div>
                <div className="ios-list-item">
                  <div className="flex-1">
                    <p className="text-xs text-[var(--ios-secondary-label)]">账户余额</p>
                    <p className="font-medium text-[var(--ios-label)]">¥{(currentUser.balance || 0).toFixed(2)}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Change Password */}
            <div className="ios-card overflow-hidden">
              <div className="px-4 py-3 border-b border-[var(--ios-separator)] flex items-center justify-between">
                <h3 className="font-semibold text-[var(--ios-label)]">修改密码</h3>
                <button
                  onClick={() => { setShowChangePassword(!showChangePassword); setPasswordMessage(''); }}
                  className="text-sm text-[var(--ios-blue)] font-medium"
                >
                  {showChangePassword ? '取消' : '修改'}
                </button>
              </div>
              
              {showChangePassword && (
                <div className="p-4 space-y-3">
                  {passwordMessage && (
                    <div className={`p-3 rounded-xl text-sm text-center ${
                      passwordMsgType === 'success' ? 'bg-[var(--ios-green)]/10 text-[var(--ios-green)]' : 'bg-[var(--ios-red)]/10 text-[var(--ios-red)]'
                    }`}>
                      {passwordMessage}
                    </div>
                  )}
                  
                  <div>
                    <input
                      type="password"
                      placeholder="旧密码"
                      value={oldPassword}
                      onChange={e => setOldPassword(e.target.value)}
                      className="ios-input"
                    />
                  </div>
                  
                  <div>
                    <input
                      type="password"
                      placeholder="新密码（至少6位）"
                      value={newPassword}
                      onChange={e => {
                        setNewPassword(e.target.value);
                        let strength = 0;
                        if (e.target.value.length >= 6) strength++;
                        if (e.target.value.length >= 10) strength++;
                        if (/[A-Z]/.test(e.target.value)) strength++;
                        if (/[0-9]/.test(e.target.value)) strength++;
                        if (/[^A-Za-z0-9]/.test(e.target.value)) strength++;
                        setPasswordStrength(strength);
                      }}
                      className="ios-input"
                    />
                    {newPassword && (
                      <div className="mt-2 flex space-x-1">
                        {[1, 2, 3, 4, 5].map(i => (
                          <div key={i} className={`h-1 flex-1 rounded-full transition-colors ${
                            i <= passwordStrength
                              ? passwordStrength <= 1 ? 'bg-[var(--ios-red)]' : passwordStrength <= 2 ? 'bg-[var(--ios-orange)]' : passwordStrength <= 3 ? 'bg-[var(--ios-yellow)]' : passwordStrength <= 4 ? 'bg-[var(--ios-blue)]' : 'bg-[var(--ios-green)]'
                              : 'bg-[var(--ios-fill)]'
                          }`} />
                        ))}
                      </div>
                    )}
                  </div>
                  
                  <div>
                    <input
                      type="password"
                      placeholder="确认新密码"
                      value={confirmNewPassword}
                      onChange={e => setConfirmNewPassword(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleChangePassword()}
                      className="ios-input"
                    />
                    {confirmNewPassword && newPassword !== confirmNewPassword && (
                      <p className="mt-1 text-xs text-[var(--ios-red)]">两次输入的密码不一致</p>
                    )}
                  </div>

                  <button
                    onClick={handleChangePassword}
                    className="ios-btn w-full"
                  >
                    确认修改
                  </button>
                </div>
              )}
              
              {!showChangePassword && (
                <div className="p-4">
                  <p className="text-sm text-[var(--ios-secondary-label)]">
                    定期修改密码可以提高账户安全性
                  </p>
                </div>
              )}
            </div>

            {/* Subscription URL */}
            <div className="ios-card overflow-hidden">
              <div className="px-4 py-3 border-b border-[var(--ios-separator)]">
                <h3 className="font-semibold text-[var(--ios-label)]">订阅链接</h3>
              </div>
              <div className="p-4">
                <div className="flex items-center space-x-2">
                  <input
                    type="text"
                    readOnly
                    value={currentUser.subscriptionUrl || '尚未生成订阅链接'}
                    className="ios-input text-xs font-mono flex-1"
                  />
                  <button
                    onClick={async () => {
                      if (currentUser.subscriptionUrl) {
                        try {
                          await navigator.clipboard.writeText(currentUser.subscriptionUrl);
                        } catch {
                          const textarea = document.createElement('textarea');
                          textarea.value = currentUser.subscriptionUrl || '';
                          document.body.appendChild(textarea);
                          textarea.select();
                          document.execCommand('copy');
                          document.body.removeChild(textarea);
                        }
                      }
                    }}
                    className="ios-btn text-xs py-2 px-3 flex-shrink-0"
                    disabled={!currentUser.subscriptionUrl}
                  >
                    复制
                  </button>
                </div>
              </div>
            </div>

            {/* Danger Zone */}
            <div className="ios-card overflow-hidden">
              <div className="px-4 py-3 border-b border-[var(--ios-separator)]">
                <h3 className="font-semibold text-[var(--ios-red)]">危险操作</h3>
              </div>
              <div className="divide-y divide-[var(--ios-separator)]">
                <button
                  onClick={() => {
                    if (window.confirm('确定要退出登录吗？')) {
                      setCurrentUser(null);
                      setCurrentView('shop');
                    }
                  }}
                  className="ios-list-item w-full text-left"
                >
                  <div className="flex-1">
                    <p className="font-medium text-[var(--ios-red)]">退出登录</p>
                    <p className="text-xs text-[var(--ios-secondary-label)]">退出当前账户</p>
                  </div>
                  <span className="text-[var(--ios-secondary-label)]">→</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
