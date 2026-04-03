import { useState, useMemo } from 'react';
import { useApp } from '../store';
import { Node } from '../types';
import PaymentConfigPanel from './PaymentConfig';
import EmailConfigPanel from './EmailConfig';
import TrafficRankingPanel from './TrafficRankingPanel';
import NodeMonitorPanel from './NodeMonitorPanel';

type TabType = 'dashboard' | 'traffic' | 'monitor' | 'subscriptions' | 'nodes' | 'plans' | 'nodeAssign' | 'users' | 'orders' | 'payment' | 'email' | 'tickets' | 'settings';

const TABS: { key: TabType; label: string; icon: string }[] = [
  { key: 'dashboard', label: '仪表盘', icon: '📊' },
  { key: 'traffic', label: '流量排行', icon: '📈' },
  { key: 'monitor', label: '节点监控', icon: '📡' },
  { key: 'subscriptions', label: '订阅源', icon: '🔗' },
  { key: 'nodes', label: '节点', icon: '🌐' },
  { key: 'plans', label: '套餐', icon: '💰' },
  { key: 'nodeAssign', label: '分配', icon: '📋' },
  { key: 'users', label: '用户', icon: '👥' },
  { key: 'orders', label: '订单', icon: '📝' },
  { key: 'payment', label: '支付', icon: '💳' },
  { key: 'email', label: '邮件', icon: '📧' },
  { key: 'tickets', label: '工单', icon: '🎫' },
];

export default function AdminPanel() {
  const {
    subscriptions, addSubscription, updateSubscription, deleteSubscription,
    nodes, addNodes, updateNode, deleteNode, batchUpdateNodeNames,
    plans, addPlan, updatePlan, deletePlan,
    assignNodesToPlan, getNodesForPlan,
    users, addUser, updateUser, deleteUser,
    orders, updateOrder,
    stats,
    setCurrentView,
    adminAuth,
    adminLogout,
    tickets, replyTicket
  } = useApp();

  const [activeTab, setActiveTab] = useState<TabType>('dashboard');
  const [selectedNodes, setSelectedNodes] = useState<string[]>([]);
  const [showAddSubscription, setShowAddSubscription] = useState(false);
  const [showAddNode, setShowAddNode] = useState(false);
  const [showAddPlan, setShowAddPlan] = useState(false);
  const [showAddUser, setShowAddUser] = useState(false);
  const [showNodeAssign, setShowNodeAssign] = useState(false);
  const [selectedPlanId, setSelectedPlanId] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedSubscriptions, setExpandedSubscriptions] = useState<Set<string>>(new Set());
  const [subSelectedNodes, setSubSelectedNodes] = useState<Record<string, Set<string>>>({});
  const [nodeViewMode, setNodeViewMode] = useState<'by-sub' | 'flat'>('by-sub');
  const [filterProtocol, setFilterProtocol] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [batchRenamePrefix, setBatchRenamePrefix] = useState('');
  const [newSubscription, setNewSubscription] = useState({ name: '', url: '', source: '' });
  const [newNode, setNewNode] = useState({ name: '', type: 'vmess', server: '', port: 443, uuid: '', alterId: 0, network: 'ws', tls: false, country: '', countryCode: '', flag: '', group: '', subscriptionId: '' });
  const [newPlan, setNewPlan] = useState({ name: '', price: 0, duration: 30, dataLimit: 100, speedLimit: 100, nodeGroups: [] as string[], features: [] as string[], isPopular: false });
  const [newUser, setNewUser] = useState({ username: '', email: '', password: '' });
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [ticketReply, setTicketReply] = useState('');

  const handleAddSubscription = () => {
    if (!newSubscription.name || !newSubscription.url) return;
    addSubscription({ id: String(subscriptions.length + 1), ...newSubscription, source: newSubscription.source || newSubscription.name, isActive: true, nodeCount: 0 });
    setNewSubscription({ name: '', url: '', source: '' });
    setShowAddSubscription(false);
  };

  const [parsingSubscription, setParsingSubscription] = useState<string | null>(null);
  const [parsePreview, setParsePreview] = useState<any>(null);
  const [showParsePreview, setShowParsePreview] = useState(false);
  const [batchTesting, setBatchTesting] = useState(false);

  const handleSyncSubscription = async (subId: string) => {
    const sub = subscriptions.find(s => s.id === subId);
    if (!sub) return;
    setParsingSubscription(subId);
    try {
      const response = await fetch('/api/subscription/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('adminToken')}` },
        body: JSON.stringify({ url: sub.url, subscriptionId: parseInt(subId) }),
      });
      const data = await response.json();
      if (data.success) {
        // 解析成功，重新加载节点
        const parsedNodes: Node[] = data.nodes.map((n: any, i: number) => ({
          id: `${subId}-${i + 1}`,
          name: n.name,
          server: n.server,
          port: n.port,
          type: n.protocol,
          uuid: n.uuid || n.password || '',
          alterId: n.alterId || 0,
          network: n.network || 'tcp',
          tls: n.tls || false,
          country: n.country === 'XX' ? '未知' : n.country,
          countryCode: n.country,
          flag: '',
          group: n.group || '默认',
          isActive: n.enabled,
          nodeId: `node-${subId}-${i + 1}`,
          subscriptionId: subId,
          latency: 0,
        }));
        addNodes(parsedNodes);
        updateSubscription(subId, {
          lastSync: new Date().toISOString().split('T')[0],
          nodeCount: parsedNodes.length,
        });
        alert(`✅ 成功解析 ${parsedNodes.length} 个节点`);
      } else {
        alert(`❌ 解析失败: ${data.message}`);
      }
    } catch (error: any) {
      alert(`❌ 解析失败: ${error.message}`);
    } finally {
      setParsingSubscription(null);
    }
  };

  const handlePreviewSubscription = async (url: string) => {
    try {
      const response = await fetch('/api/subscription/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('adminToken')}` },
        body: JSON.stringify({ url }),
      });
      const data = await response.json();
      if (data.success) {
        setParsePreview(data);
        setShowParsePreview(true);
      } else {
        alert(`❌ 预览失败: ${data.message}`);
      }
    } catch (error: any) {
      alert(`❌ 预览失败: ${error.message}`);
    }
  };

  const handleBatchLatencyTest = async (subId?: string) => {
    setBatchTesting(true);
    try {
      const testNodes = subId
        ? (getNodesBySubscription[subId] || [])
        : nodes;
      const response = await fetch('/api/subscription/batch-latency', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('adminToken')}` },
        body: JSON.stringify({ nodes: testNodes.map(n => ({ id: n.id, server: n.server, port: n.port })) }),
      });
      const data = await response.json();
      if (data.success) {
        alert(`✅ 完成 ${data.results?.length || 0} 个节点测试\n在线: ${data.online}\n离线: ${data.offline}`);
      } else {
        alert(`❌ 测试失败: ${data.message}`);
      }
    } catch (error: any) {
      alert(`❌ 测试失败: ${error.message}`);
    } finally {
      setBatchTesting(false);
    }
  };

  const handleAddNode = () => {
    if (!newNode.name || !newNode.server) return;
    addNodes([{ id: String(nodes.length + 1), ...newNode, isActive: true } as Node]);
    setNewNode({ name: '', type: 'vmess', server: '', port: 443, uuid: '', alterId: 0, network: 'ws', tls: false, country: '', countryCode: '', flag: '', group: '', subscriptionId: '' });
    setShowAddNode(false);
  };

  const handleAddPlan = () => {
    if (!newPlan.name || newPlan.price <= 0) return;
    addPlan({ id: String(plans.length + 1), ...newPlan, isActive: true });
    setNewPlan({ name: '', price: 0, duration: 30, dataLimit: 100, speedLimit: 100, nodeGroups: [], features: [], isPopular: false });
    setShowAddPlan(false);
  };

  const handleAddUser = () => {
    if (!newUser.username || !newUser.email) return;
    addUser({ id: String(users.length + 1), username: newUser.username, email: newUser.email, balance: 0, dataUsed: 0, status: 'active', createdAt: new Date().toISOString().split('T')[0] });
    setNewUser({ username: '', email: '', password: '' });
    setShowAddUser(false);
  };

  const handleAssignNodes = () => {
    if (!selectedPlanId || selectedNodes.length === 0) return;
    assignNodesToPlan(selectedPlanId, selectedNodes);
    setSelectedNodes([]);
    setShowNodeAssign(false);
  };

  const toggleSubscriptionExpand = (subId: string) => {
    setExpandedSubscriptions(prev => { const next = new Set(prev); next.has(subId) ? next.delete(subId) : next.add(subId); return next; });
  };

  const toggleSubAllNodes = (subId: string, subNodes: Node[]) => {
    setSubSelectedNodes(prev => {
      const current = prev[subId] || new Set();
      const allSelected = subNodes.length > 0 && subNodes.every(n => current.has(n.id));
      const next = new Set<string>();
      if (!allSelected) subNodes.forEach(n => next.add(n.id));
      return { ...prev, [subId]: next };
    });
  };

  const isSubAllSelected = (subId: string, subNodes: Node[]) => {
    const current = subSelectedNodes[subId] || new Set();
    return subNodes.length > 0 && subNodes.every(n => current.has(n.id));
  };

  const getSubSelectedCount = (subId: string) => (subSelectedNodes[subId] || new Set()).size;

  const getNodesBySubscription = useMemo(() => {
    const grouped: Record<string, Node[]> = {};
    nodes.forEach(node => {
      const subId = node.subscriptionId || 'manual';
      if (!grouped[subId]) grouped[subId] = [];
      grouped[subId].push(node);
    });
    return grouped;
  }, [nodes]);

  const getFilteredNodes = (nodeList: Node[]) => {
    return nodeList.filter(node => {
      const matchesSearch = searchTerm === '' || node.name.toLowerCase().includes(searchTerm.toLowerCase()) || node.server.toLowerCase().includes(searchTerm.toLowerCase()) || node.country.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesProtocol = filterProtocol === 'all' || node.type === filterProtocol;
      const matchesStatus = filterStatus === 'all' || (filterStatus === 'active' && node.isActive) || (filterStatus === 'inactive' && !node.isActive);
      return matchesSearch && matchesProtocol && matchesStatus;
    });
  };

  const toggleNodeSelection = (nodeId: string) => {
    setSelectedNodes(prev => prev.includes(nodeId) ? prev.filter(id => id !== nodeId) : [...prev, nodeId]);
  };

  const handleBatchRename = () => {
    if (batchRenamePrefix && selectedNodes.length > 0) {
      batchUpdateNodeNames(selectedNodes, batchRenamePrefix);
      setBatchRenamePrefix('');
      setSelectedNodes([]);
    }
  };

  const handleBatchEnable = () => {
    selectedNodes.forEach(id => updateNode(id, { isActive: true }));
    setSelectedNodes([]);
  };

  const handleBatchDisable = () => {
    selectedNodes.forEach(id => updateNode(id, { isActive: false }));
    setSelectedNodes([]);
  };

  const handleBatchDelete = () => {
    if (confirm(`确定删除 ${selectedNodes.length} 个节点？`)) {
      selectedNodes.forEach(id => deleteNode(id));
      setSelectedNodes([]);
    }
  };

  const handleTicketReply = () => {
    if (!ticketReply.trim() || !selectedTicketId) return;
    replyTicket(selectedTicketId, ticketReply, 'admin', adminAuth.admin?.username || 'admin');
    setTicketReply('');
  };

  const getSubInfo = (subId: string) => {
    if (subId === 'manual') return { name: '手动添加', color: 'var(--ios-secondary-label)', icon: '✏️' };
    const sub = subscriptions.find(s => s.id === subId);
    if (!sub) return { name: '未知来源', color: 'var(--ios-red)', icon: '❓' };
    const colors = ['var(--ios-purple)', 'var(--ios-blue)', 'var(--ios-green)', 'var(--ios-orange)', 'var(--ios-pink)', 'var(--ios-indigo)'];
    return { name: sub.name, color: colors[subscriptions.indexOf(sub) % colors.length], icon: '🔗', url: sub.url, isActive: sub.isActive, lastSync: sub.lastSync };
  };

  const statusBadge = (status: string) => {
    const map: Record<string, { label: string; color: string }> = {
      'paid': { label: '已支付', color: 'var(--ios-green)' },
      'pending': { label: '待支付', color: 'var(--ios-orange)' },
      'completed': { label: '已完成', color: 'var(--ios-green)' },
      'cancelled': { label: '已取消', color: 'var(--ios-secondary-label)' },
      'processing': { label: '处理中', color: 'var(--ios-blue)' },
      'active': { label: '正常', color: 'var(--ios-green)' },
      'inactive': { label: '已停用', color: 'var(--ios-secondary-label)' },
      'open': { label: '待处理', color: 'var(--ios-orange)' },
      'resolved': { label: '已解决', color: 'var(--ios-green)' },
      'closed': { label: '已关闭', color: 'var(--ios-secondary-label)' },
    };
    const info = map[status] || { label: status, color: 'var(--ios-secondary-label)' };
    return <span className="ios-badge" style={{ backgroundColor: `${info.color}15`, color: info.color }}>{info.label}</span>;
  };

  return (
    <div className="min-h-screen bg-[var(--ios-bg)] pb-24">
      {/* iOS Navigation Bar */}
      <nav className="ios-navbar">
        <div className="mx-auto max-w-5xl px-4 py-3 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <button onClick={() => setCurrentView('shop')} className="text-[var(--ios-blue)] text-sm font-medium">← 商城</button>
            <span className="text-lg font-semibold text-[var(--ios-label)]">管理后台</span>
            {adminAuth.admin && <span className="text-xs text-[var(--ios-secondary-label)]">{adminAuth.admin.username}</span>}
          </div>
          <div className="flex items-center space-x-2">
            <button onClick={() => setCurrentView('shop')} className="text-sm text-[var(--ios-secondary-label)] hover:text-[var(--ios-label)] transition-colors">返回商城</button>
            <button onClick={adminLogout} className="text-sm text-[var(--ios-red)] font-medium">退出</button>
          </div>
        </div>
      </nav>

      {/* Large Title */}
      <div className="mx-auto max-w-5xl px-4 pt-4 pb-2">
        <h1 className="ios-large-title text-[var(--ios-label)]">管理面板</h1>
      </div>

      {/* Tab Bar */}
      <div className="mx-auto max-w-5xl px-4 mb-4 overflow-x-auto">
        <div className="ios-segmented" style={{ minWidth: 'max-content' }}>
          {TABS.map(tab => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)} className={`ios-segmented-item text-xs whitespace-nowrap ${activeTab === tab.key ? 'active' : ''}`}>
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-4">
        {/* ===== Dashboard ===== */}
        {activeTab === 'dashboard' && (
          <div className="space-y-4 ios-fade-in">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="ios-card p-4">
                <p className="text-xs text-[var(--ios-secondary-label)] mb-1">总用户</p>
                <p className="text-2xl font-bold text-[var(--ios-label)]">{stats.totalUsers}</p>
              </div>
              <div className="ios-card p-4">
                <p className="text-xs text-[var(--ios-secondary-label)] mb-1">活跃用户</p>
                <p className="text-2xl font-bold text-[var(--ios-green)]">{stats.activeUsers}</p>
              </div>
              <div className="ios-card p-4">
                <p className="text-xs text-[var(--ios-secondary-label)] mb-1">总收入</p>
                <p className="text-2xl font-bold text-[var(--ios-label)]">¥{stats.totalRevenue.toLocaleString()}</p>
              </div>
              <div className="ios-card p-4">
                <p className="text-xs text-[var(--ios-secondary-label)] mb-1">节点</p>
                <p className="text-2xl font-bold text-[var(--ios-label)]">{stats.activeNodes}/{stats.totalNodes}</p>
              </div>
            </div>

            <div className="ios-card overflow-hidden">
              <div className="px-4 py-3 border-b border-[var(--ios-separator)]">
                <h3 className="font-semibold text-[var(--ios-label)]">最近订单</h3>
              </div>
              <div className="divide-y divide-[var(--ios-separator)]">
                {orders.slice(-5).reverse().map((order) => (
                  <div key={order.id} className="ios-list-item">
                    <div className="flex-1">
                      <div className="font-medium text-[var(--ios-label)]">用户 #{order.userId}</div>
                      <div className="text-xs text-[var(--ios-secondary-label)]">{order.createdAt}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold text-[var(--ios-label)]">¥{order.amount}</div>
                      {statusBadge(order.status)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ===== Traffic Ranking ===== */}
        {activeTab === 'traffic' && (
          <div className="ios-fade-in">
            <TrafficRankingPanel />
          </div>
        )}

        {/* ===== Node Monitor ===== */}
        {activeTab === 'monitor' && (
          <div className="ios-fade-in">
            <NodeMonitorPanel />
          </div>
        )}

        {/* ===== Subscriptions ===== */}
        {activeTab === 'subscriptions' && (
          <div className="space-y-4 ios-fade-in">
            <div className="flex justify-between items-center">
              <h2 className="ios-subtitle text-[var(--ios-label)]">订阅源</h2>
              <button onClick={() => setShowAddSubscription(true)} className="ios-btn text-sm py-2 px-4">添加订阅源</button>
            </div>

            <div className="ios-card overflow-hidden">
              <div className="divide-y divide-[var(--ios-separator)]">
                {subscriptions.map((sub) => (
                  <div key={sub.id} className="ios-list-item">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2">
                        <span className="text-lg">🔗</span>
                        <div>
                          <div className="font-medium text-[var(--ios-label)]">{sub.name}</div>
                          <div className="text-xs text-[var(--ios-secondary-label)] truncate max-w-xs">{sub.url}</div>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-3">
                      <div className="text-right">
                        <div className="text-xs text-[var(--ios-secondary-label)]">节点</div>
                        <div className="font-medium text-[var(--ios-label)]">{sub.nodeCount}</div>
                      </div>
                      <button onClick={() => handlePreviewSubscription(sub.url)} className="text-xs text-[var(--ios-blue)] font-medium">预览</button>
                      <button onClick={() => handleSyncSubscription(sub.id)} disabled={parsingSubscription === sub.id} className="text-xs text-[var(--ios-blue)] font-medium disabled:opacity-50">
                        {parsingSubscription === sub.id ? '解析中...' : '同步'}
                      </button>
                      <button onClick={() => updateSubscription(sub.id, { isActive: !sub.isActive })} className="text-xs font-medium" style={{ color: sub.isActive ? 'var(--ios-green)' : 'var(--ios-red)' }}>
                        {sub.isActive ? '启用' : '禁用'}
                      </button>
                      <button onClick={() => deleteSubscription(sub.id)} className="text-xs text-[var(--ios-red)] font-medium">删除</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {showAddSubscription && (
              <div className="ios-modal-overlay" onClick={() => setShowAddSubscription(false)}>
                <div className="ios-modal" onClick={e => e.stopPropagation()}>
                  <div className="p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="ios-subtitle text-[var(--ios-label)]">添加订阅源</h3>
                      <button onClick={() => setShowAddSubscription(false)} className="text-2xl text-[var(--ios-secondary-label)] leading-none">×</button>
                    </div>
                    <div className="space-y-3">
                      <input type="text" placeholder="名称" value={newSubscription.name} onChange={(e) => setNewSubscription({ ...newSubscription, name: e.target.value })} className="ios-input" />
                      <input type="text" placeholder="订阅URL" value={newSubscription.url} onChange={(e) => setNewSubscription({ ...newSubscription, url: e.target.value })} className="ios-input" />
                      <input type="text" placeholder="来源（可选）" value={newSubscription.source} onChange={(e) => setNewSubscription({ ...newSubscription, source: e.target.value })} className="ios-input" />
                      <div className="flex space-x-2">
                        <button onClick={handleAddSubscription} className="ios-btn flex-1">添加</button>
                        <button onClick={() => setShowAddSubscription(false)} className="ios-btn ios-btn-secondary flex-1">取消</button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Parse Preview Modal */}
            {showParsePreview && parsePreview && (
              <div className="ios-modal-overlay" onClick={() => setShowParsePreview(false)}>
                <div className="ios-modal max-w-lg" onClick={e => e.stopPropagation()}>
                  <div className="p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="ios-subtitle text-[var(--ios-label)]">订阅预览</h3>
                      <button onClick={() => setShowParsePreview(false)} className="text-2xl text-[var(--ios-secondary-label)] leading-none">×</button>
                    </div>
                    <div className="space-y-3">
                      <div className="bg-[var(--ios-fill)] rounded-xl p-3">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium text-[var(--ios-label)]">解析结果</span>
                          <span className="ios-badge bg-[var(--ios-green)]/15 text-[var(--ios-green)]">{parsePreview.count} 个节点</span>
                        </div>
                        <div className="text-xs text-[var(--ios-secondary-label)] mb-2">内容预览</div>
                        <pre className="text-[10px] text-[var(--ios-secondary-label)] bg-[var(--ios-bg)] rounded-lg p-2 max-h-32 overflow-auto whitespace-pre-wrap break-all">
                          {parsePreview.preview}
                        </pre>
                      </div>
                      {parsePreview.nodes && parsePreview.nodes.length > 0 && (
                        <div className="max-h-48 overflow-y-auto space-y-1">
                          {parsePreview.nodes.slice(0, 10).map((node: any, i: number) => (
                            <div key={i} className="flex items-center space-x-2 p-2 bg-[var(--ios-fill)] rounded-lg">
                              <span className="text-xs">{node.type === 'vmess' ? '🔷' : node.type === 'trojan' ? '🛡️' : node.type === 'vless' ? '🔶' : '🔒'}</span>
                              <span className="text-xs text-[var(--ios-label)] truncate flex-1">{node.name}</span>
                              <span className="text-[10px] text-[var(--ios-secondary-label)]">{node.server}:{node.port}</span>
                            </div>
                          ))}
                          {parsePreview.nodes.length > 10 && (
                            <div className="text-center text-xs text-[var(--ios-secondary-label)] py-1">
                              ... 还有 {parsePreview.nodes.length - 10} 个节点
                            </div>
                          )}
                        </div>
                      )}
                      <button onClick={() => setShowParsePreview(false)} className="ios-btn w-full">关闭</button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ===== Nodes ===== */}
        {activeTab === 'nodes' && (
          <div className="space-y-4 ios-fade-in">
            <div className="flex justify-between items-center flex-wrap gap-2">
              <h2 className="ios-subtitle text-[var(--ios-label)]">节点管理</h2>
              <div className="flex items-center space-x-2">
                <button onClick={() => setNodeViewMode(nodeViewMode === 'by-sub' ? 'flat' : 'by-sub')} className="ios-btn ios-btn-secondary text-xs py-2 px-3">
                  {nodeViewMode === 'by-sub' ? '列表视图' : '分组视图'}
                </button>
                <button onClick={() => setShowAddNode(true)} className="ios-btn text-xs py-2 px-3">添加节点</button>
              </div>
            </div>

            {/* Search & Filters */}
            <div className="ios-card p-3 space-y-2">
              <input type="text" placeholder="搜索节点..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="ios-input text-sm" />
              <div className="flex items-center space-x-2 flex-wrap gap-2">
                <select value={filterProtocol} onChange={e => setFilterProtocol(e.target.value)} className="ios-input text-sm flex-1 min-w-[100px]">
                  <option value="all">全部协议</option>
                  <option value="vmess">VMess</option>
                  <option value="vless">VLESS</option>
                  <option value="trojan">Trojan</option>
                  <option value="ss">SS</option>
                  <option value="hysteria2">Hysteria2</option>
                  <option value="tuic">TUIC</option>
                </select>
                <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="ios-input text-sm flex-1 min-w-[100px]">
                  <option value="all">全部状态</option>
                  <option value="active">启用</option>
                  <option value="inactive">禁用</option>
                </select>
              </div>
            </div>

            {/* Batch Actions */}
            {selectedNodes.length > 0 && (
              <div className="ios-card p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-[var(--ios-label)]">已选择 {selectedNodes.length} 个节点</span>
                  <button onClick={() => setSelectedNodes([])} className="text-xs text-[var(--ios-secondary-label)]">清除</button>
                </div>
                <div className="flex flex-wrap gap-2">
                  <input type="text" placeholder="批量重命名前缀" value={batchRenamePrefix} onChange={e => setBatchRenamePrefix(e.target.value)} className="ios-input text-sm flex-1 min-w-[120px]" />
                  <button onClick={handleBatchRename} className="ios-btn text-xs py-2 px-3">重命名</button>
                  <button onClick={handleBatchEnable} className="ios-btn text-xs py-2 px-3" style={{ backgroundColor: 'var(--ios-green)' }}>启用</button>
                  <button onClick={handleBatchDisable} className="ios-btn text-xs py-2 px-3" style={{ backgroundColor: 'var(--ios-orange)' }}>禁用</button>
                  <button onClick={handleBatchDelete} className="ios-btn text-xs py-2 px-3" style={{ backgroundColor: 'var(--ios-red)' }}>删除</button>
                  <button onClick={() => handleBatchLatencyTest()} disabled={batchTesting} className="ios-btn text-xs py-2 px-3 disabled:opacity-50" style={{ backgroundColor: '#5856D6' }}>{batchTesting ? '⏳ 测试中...' : '⚡ 批量测速'}</button>
                </div>
              </div>
            )}

            {/* Node List - By Subscription */}
            {nodeViewMode === 'by-sub' && (
              <div className="space-y-3">
                {Object.entries(getNodesBySubscription).map(([subId, subNodes]) => {
                  const filtered = getFilteredNodes(subNodes);
                  const info = getSubInfo(subId);
                  const isExpanded = expandedSubscriptions.has(subId);
                  const selectedCount = getSubSelectedCount(subId);
                  const allSelected = isSubAllSelected(subId, filtered);

                  return (
                    <div key={subId} className="ios-card overflow-hidden">
                      {/* Subscription Header */}
                      <button
                        onClick={() => toggleSubscriptionExpand(subId)}
                        className="w-full px-4 py-3 flex items-center justify-between border-b border-[var(--ios-separator)]"
                      >
                        <div className="flex items-center space-x-3">
                          <div className="flex h-8 w-8 items-center justify-center rounded-lg text-white text-sm" style={{ backgroundColor: info.color }}>
                            {info.icon}
                          </div>
                          <div className="text-left">
                            <div className="font-medium text-[var(--ios-label)] text-sm">{info.name}</div>
                            <div className="text-xs text-[var(--ios-secondary-label)]">{filtered.length} 个节点{selectedCount > 0 && ` · ${selectedCount} 已选`}</div>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={e => { e.stopPropagation(); toggleSubAllNodes(subId, filtered); }}
                            className="text-xs text-[var(--ios-blue)] font-medium"
                          >
                            {allSelected ? '全不选' : '全选'}
                          </button>
                          <span className={`text-[var(--ios-secondary-label)] transition-transform ${isExpanded ? 'rotate-180' : ''}`}>▼</span>
                        </div>
                      </button>

                      {/* Nodes */}
                      {isExpanded && (
                        <div className="divide-y divide-[var(--ios-separator)]">
                          {filtered.map((node) => {
                            const isSelected = selectedNodes.includes(node.id);
                            return (
                              <div key={node.id} className={`ios-list-item ${isSelected ? 'bg-[var(--ios-blue)]/5' : ''}`}>
                                <button
                                  onClick={() => toggleNodeSelection(node.id)}
                                  className={`flex h-5 w-5 items-center justify-center rounded border-2 mr-3 flex-shrink-0 transition-colors ${
                                    isSelected ? 'bg-[var(--ios-blue)] border-[var(--ios-blue)]' : 'border-[var(--ios-separator)]'
                                  }`}
                                >
                                  {isSelected && <span className="text-white text-xs">✓</span>}
                                </button>
                                <div className="ios-list-item-icon bg-[var(--ios-fill)]">
                                  <span className="text-sm">{node.flag || '🌐'}</span>
                                </div>
                                <div className="flex-1 ml-3 min-w-0">
                                  <div className="font-medium text-[var(--ios-label)] text-sm truncate">{node.customName || node.name}</div>
                                  <div className="text-xs text-[var(--ios-secondary-label)]">{node.server}:{node.port} · {node.type.toUpperCase()}</div>
                                </div>
                                <span className={`ios-badge text-[10px] ${node.isActive ? 'bg-[var(--ios-green)]/15 text-[var(--ios-green)]' : 'bg-[var(--ios-secondary-label)]/15 text-[var(--ios-secondary-label)]'}`}>
                                  {node.isActive ? '启用' : '禁用'}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Node List - Flat */}
            {nodeViewMode === 'flat' && (
              <div className="ios-card overflow-hidden">
                <div className="divide-y divide-[var(--ios-separator)]">
                  {getFilteredNodes(nodes).map((node) => {
                    const isSelected = selectedNodes.includes(node.id);
                    return (
                      <div key={node.id} className={`ios-list-item ${isSelected ? 'bg-[var(--ios-blue)]/5' : ''}`}>
                        <button onClick={() => toggleNodeSelection(node.id)} className={`flex h-5 w-5 items-center justify-center rounded border-2 mr-3 flex-shrink-0 transition-colors ${isSelected ? 'bg-[var(--ios-blue)] border-[var(--ios-blue)]' : 'border-[var(--ios-separator)]'}`}>
                          {isSelected && <span className="text-white text-xs">✓</span>}
                        </button>
                        <div className="ios-list-item-icon bg-[var(--ios-fill)]">
                          <span className="text-sm">{node.flag || '🌐'}</span>
                        </div>
                        <div className="flex-1 ml-3 min-w-0">
                          <div className="font-medium text-[var(--ios-label)] text-sm truncate">{node.customName || node.name}</div>
                          <div className="text-xs text-[var(--ios-secondary-label)]">{node.server}:{node.port} · {node.type.toUpperCase()}</div>
                        </div>
                        <span className={`ios-badge text-[10px] ${node.isActive ? 'bg-[var(--ios-green)]/15 text-[var(--ios-green)]' : 'bg-[var(--ios-secondary-label)]/15 text-[var(--ios-secondary-label)]'}`}>
                          {node.isActive ? '启用' : '禁用'}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Add Node Modal */}
            {showAddNode && (
              <div className="ios-modal-overlay" onClick={() => setShowAddNode(false)}>
                <div className="ios-modal" onClick={e => e.stopPropagation()}>
                  <div className="p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="ios-subtitle text-[var(--ios-label)]">添加节点</h3>
                      <button onClick={() => setShowAddNode(false)} className="text-2xl text-[var(--ios-secondary-label)] leading-none">×</button>
                    </div>
                    <div className="space-y-3">
                      <input type="text" placeholder="节点名称" value={newNode.name} onChange={e => setNewNode({ ...newNode, name: e.target.value })} className="ios-input" />
                      <div className="grid grid-cols-2 gap-2">
                        <input type="text" placeholder="服务器" value={newNode.server} onChange={e => setNewNode({ ...newNode, server: e.target.value })} className="ios-input" />
                        <input type="number" placeholder="端口" value={newNode.port} onChange={e => setNewNode({ ...newNode, port: Number(e.target.value) })} className="ios-input" />
                      </div>
                      <select value={newNode.type} onChange={e => setNewNode({ ...newNode, type: e.target.value })} className="ios-input">
                        <option value="vmess">VMess</option>
                        <option value="vless">VLESS</option>
                        <option value="trojan">Trojan</option>
                        <option value="ss">SS</option>
                        <option value="hysteria2">Hysteria2</option>
                        <option value="tuic">TUIC</option>
                      </select>
                      <input type="text" placeholder="国家/地区" value={newNode.country} onChange={e => setNewNode({ ...newNode, country: e.target.value })} className="ios-input" />
                      <input type="text" placeholder="国家代码 (如 HK)" value={newNode.countryCode} onChange={e => setNewNode({ ...newNode, countryCode: e.target.value })} className="ios-input" />
                      <input type="text" placeholder="国旗emoji (如 🇭🇰)" value={newNode.flag} onChange={e => setNewNode({ ...newNode, flag: e.target.value })} className="ios-input" />
                      <input type="text" placeholder="分组" value={newNode.group} onChange={e => setNewNode({ ...newNode, group: e.target.value })} className="ios-input" />
                      <select value={newNode.subscriptionId} onChange={e => setNewNode({ ...newNode, subscriptionId: e.target.value })} className="ios-input">
                        <option value="">选择订阅源（可选）</option>
                        {subscriptions.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                      </select>
                      <div className="flex space-x-2">
                        <button onClick={handleAddNode} className="ios-btn flex-1">添加</button>
                        <button onClick={() => setShowAddNode(false)} className="ios-btn ios-btn-secondary flex-1">取消</button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ===== Plans ===== */}
        {activeTab === 'plans' && (
          <div className="space-y-4 ios-fade-in">
            <div className="flex justify-between items-center">
              <h2 className="ios-subtitle text-[var(--ios-label)]">套餐管理</h2>
              <button onClick={() => setShowAddPlan(true)} className="ios-btn text-sm py-2 px-4">添加套餐</button>
            </div>

            <div className="ios-card overflow-hidden">
              <div className="divide-y divide-[var(--ios-separator)]">
                {plans.map((plan) => (
                  <div key={plan.id} className="ios-list-item">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2">
                        <span className="text-lg">{plan.isPopular ? '⭐' : '📦'}</span>
                        <div>
                          <div className="font-medium text-[var(--ios-label)]">{plan.name}</div>
                          <div className="text-xs text-[var(--ios-secondary-label)]">{plan.dataLimit}GB · {plan.duration}天 · ¥{plan.price}</div>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      {statusBadge(plan.isActive ? 'active' : 'inactive')}
                      <button onClick={() => updatePlan(plan.id, { isActive: !plan.isActive })} className="text-xs font-medium" style={{ color: plan.isActive ? 'var(--ios-green)' : 'var(--ios-red)' }}>
                        {plan.isActive ? '启用' : '禁用'}
                      </button>
                      <button onClick={() => deletePlan(plan.id)} className="text-xs text-[var(--ios-red)] font-medium">删除</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {showAddPlan && (
              <div className="ios-modal-overlay" onClick={() => setShowAddPlan(false)}>
                <div className="ios-modal" onClick={e => e.stopPropagation()}>
                  <div className="p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="ios-subtitle text-[var(--ios-label)]">添加套餐</h3>
                      <button onClick={() => setShowAddPlan(false)} className="text-2xl text-[var(--ios-secondary-label)] leading-none">×</button>
                    </div>
                    <div className="space-y-3">
                      <input type="text" placeholder="套餐名称" value={newPlan.name} onChange={e => setNewPlan({ ...newPlan, name: e.target.value })} className="ios-input" />
                      <div className="grid grid-cols-2 gap-2">
                        <input type="number" placeholder="价格 (¥)" value={newPlan.price || ''} onChange={e => setNewPlan({ ...newPlan, price: Number(e.target.value) })} className="ios-input" />
                        <input type="number" placeholder="天数" value={newPlan.duration || ''} onChange={e => setNewPlan({ ...newPlan, duration: Number(e.target.value) })} className="ios-input" />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <input type="number" placeholder="流量 (GB)" value={newPlan.dataLimit || ''} onChange={e => setNewPlan({ ...newPlan, dataLimit: Number(e.target.value) })} className="ios-input" />
                        <input type="number" placeholder="限速 (Mbps)" value={newPlan.speedLimit || ''} onChange={e => setNewPlan({ ...newPlan, speedLimit: Number(e.target.value) })} className="ios-input" />
                      </div>
                      <label className="flex items-center space-x-3">
                        <button onClick={() => setNewPlan(p => ({ ...p, isPopular: !p.isPopular }))} className={`ios-toggle ${newPlan.isPopular ? 'active' : ''}`} />
                        <span className="text-sm text-[var(--ios-label)]">设为热门套餐</span>
                      </label>
                      <div className="flex space-x-2">
                        <button onClick={handleAddPlan} className="ios-btn flex-1">添加</button>
                        <button onClick={() => setShowAddPlan(false)} className="ios-btn ios-btn-secondary flex-1">取消</button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ===== Node Assignment ===== */}
        {activeTab === 'nodeAssign' && (
          <div className="space-y-4 ios-fade-in">
            <div className="flex justify-between items-center">
              <h2 className="ios-subtitle text-[var(--ios-label)]">节点分配</h2>
              <button onClick={() => setShowNodeAssign(true)} className="ios-btn text-sm py-2 px-4">分配节点</button>
            </div>

            {plans.filter(p => p.isActive).map(plan => {
              const planNodesList = getNodesForPlan(plan.id);
              return (
                <div key={plan.id} className="ios-card overflow-hidden">
                  <div className="px-4 py-3 border-b border-[var(--ios-separator)]">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-semibold text-[var(--ios-label)]">{plan.name}</h3>
                        <p className="text-xs text-[var(--ios-secondary-label)]">{planNodesList.length} 个节点</p>
                      </div>
                      <span className="ios-badge bg-[var(--ios-blue)]/15 text-[var(--ios-blue)]">{plan.dataLimit}GB</span>
                    </div>
                  </div>
                  <div className="divide-y divide-[var(--ios-separator)]">
                    {planNodesList.length > 0 ? planNodesList.map(node => (
                      <div key={node.id} className="ios-list-item">
                        <div className="ios-list-item-icon bg-[var(--ios-fill)]">
                          <span className="text-sm">{node.flag || '🌐'}</span>
                        </div>
                        <div className="flex-1 ml-3">
                          <div className="font-medium text-[var(--ios-label)] text-sm">{node.customName || node.name}</div>
                          <div className="text-xs text-[var(--ios-secondary-label)]">{node.server}:{node.port}</div>
                        </div>
                      </div>
                    )) : (
                      <div className="p-6 text-center">
                        <p className="text-[var(--ios-secondary-label)] text-sm">暂无节点</p>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {showNodeAssign && (
              <div className="ios-modal-overlay" onClick={() => setShowNodeAssign(false)}>
                <div className="ios-modal" onClick={e => e.stopPropagation()}>
                  <div className="p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="ios-subtitle text-[var(--ios-label)]">分配节点</h3>
                      <button onClick={() => setShowNodeAssign(false)} className="text-2xl text-[var(--ios-secondary-label)] leading-none">×</button>
                    </div>
                    <div className="space-y-3">
                      <select value={selectedPlanId} onChange={e => setSelectedPlanId(e.target.value)} className="ios-input">
                        <option value="">选择套餐</option>
                        {plans.filter(p => p.isActive).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </select>
                      <div className="max-h-64 overflow-y-auto space-y-1">
                        {nodes.filter(n => n.isActive).map(node => (
                          <label key={node.id} className="flex items-center space-x-3 p-2 rounded-lg hover:bg-[var(--ios-fill)] cursor-pointer">
                            <input type="checkbox" checked={selectedNodes.includes(node.id)} onChange={() => toggleNodeSelection(node.id)} className="rounded" />
                            <span className="text-sm text-[var(--ios-label)]">{node.flag} {node.name}</span>
                          </label>
                        ))}
                      </div>
                      <div className="flex space-x-2">
                        <button onClick={handleAssignNodes} className="ios-btn flex-1">确认分配</button>
                        <button onClick={() => setShowNodeAssign(false)} className="ios-btn ios-btn-secondary flex-1">取消</button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ===== Users ===== */}
        {activeTab === 'users' && (
          <div className="space-y-4 ios-fade-in">
            <div className="flex justify-between items-center">
              <h2 className="ios-subtitle text-[var(--ios-label)]">用户管理</h2>
              <button onClick={() => setShowAddUser(true)} className="ios-btn text-sm py-2 px-4">添加用户</button>
            </div>

            <div className="ios-card overflow-hidden">
              <div className="divide-y divide-[var(--ios-separator)]">
                {users.map(user => (
                  <div key={user.id} className="ios-list-item">
                    <div className="ios-list-item-icon bg-[var(--ios-fill)]">
                      <span className="text-lg">👤</span>
                    </div>
                    <div className="flex-1 ml-3">
                      <div className="font-medium text-[var(--ios-label)]">{user.username}</div>
                      <div className="text-xs text-[var(--ios-secondary-label)]">{user.email} · 注册于 {user.createdAt}</div>
                    </div>
                    <div className="flex items-center space-x-2">
                      {statusBadge(user.status)}
                      <button onClick={() => updateUser(user.id, { status: user.status === 'active' ? 'suspended' : 'active' })} className="text-xs font-medium" style={{ color: user.status === 'active' ? 'var(--ios-orange)' : 'var(--ios-green)' }}>
                        {user.status === 'active' ? '暂停' : '启用'}
                      </button>
                      <button onClick={() => deleteUser(user.id)} className="text-xs text-[var(--ios-red)] font-medium">删除</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {showAddUser && (
              <div className="ios-modal-overlay" onClick={() => setShowAddUser(false)}>
                <div className="ios-modal" onClick={e => e.stopPropagation()}>
                  <div className="p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="ios-subtitle text-[var(--ios-label)]">添加用户</h3>
                      <button onClick={() => setShowAddUser(false)} className="text-2xl text-[var(--ios-secondary-label)] leading-none">×</button>
                    </div>
                    <div className="space-y-3">
                      <input type="text" placeholder="用户名" value={newUser.username} onChange={e => setNewUser({ ...newUser, username: e.target.value })} className="ios-input" />
                      <input type="email" placeholder="邮箱" value={newUser.email} onChange={e => setNewUser({ ...newUser, email: e.target.value })} className="ios-input" />
                      <input type="password" placeholder="密码" value={newUser.password} onChange={e => setNewUser({ ...newUser, password: e.target.value })} className="ios-input" />
                      <div className="flex space-x-2">
                        <button onClick={handleAddUser} className="ios-btn flex-1">添加</button>
                        <button onClick={() => setShowAddUser(false)} className="ios-btn ios-btn-secondary flex-1">取消</button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ===== Orders ===== */}
        {activeTab === 'orders' && (
          <div className="space-y-4 ios-fade-in">
            <h2 className="ios-subtitle text-[var(--ios-label)]">订单管理</h2>
            <div className="ios-card overflow-hidden">
              <div className="divide-y divide-[var(--ios-separator)]">
                {orders.map(order => (
                  <div key={order.id} className="ios-list-item">
                    <div className="ios-list-item-icon bg-[var(--ios-fill)]">
                      <span className="text-lg">{order.paymentMethod === 'alipay' ? '💰' : '🪙'}</span>
                    </div>
                    <div className="flex-1 ml-3">
                      <div className="font-medium text-[var(--ios-label)]">订单 #{order.id}</div>
                      <div className="text-xs text-[var(--ios-secondary-label)]">用户 #{order.userId} · {order.createdAt}</div>
                    </div>
                    <div className="text-right flex items-center space-x-2">
                      <div>
                        <div className="font-semibold text-[var(--ios-label)]">¥{order.amount}</div>
                        {statusBadge(order.status)}
                      </div>
                      {order.status === 'pending' && (
                        <button onClick={() => updateOrder(order.id, { status: 'completed' })} className="text-xs text-[var(--ios-green)] font-medium">
                          确认
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ===== Payment ===== */}
        {activeTab === 'payment' && <PaymentConfigPanel />}

        {/* ===== Email ===== */}
        {activeTab === 'email' && <EmailConfigPanel />}

        {/* ===== Tickets ===== */}
        {activeTab === 'tickets' && !selectedTicketId && (
          <div className="space-y-4 ios-fade-in">
            <h2 className="ios-subtitle text-[var(--ios-label)]">工单管理</h2>
            <div className="ios-card overflow-hidden">
              <div className="divide-y divide-[var(--ios-separator)]">
                {tickets.length > 0 ? tickets.map(ticket => (
                  <button key={ticket.id} onClick={() => setSelectedTicketId(ticket.id)} className="w-full ios-list-item text-left">
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-[var(--ios-label)]">{ticket.subject}</span>
                        {statusBadge(ticket.status)}
                      </div>
                      <div className="text-xs text-[var(--ios-secondary-label)] mt-1">
                        {ticket.ticketNo} · {ticket.category} · {ticket.lastReplyAt?.slice(0, 10) || ticket.updatedAt?.slice(0, 10)}
                      </div>
                    </div>
                  </button>
                )) : (
                  <div className="ios-empty">
                    <div className="ios-empty-icon">🎫</div>
                    <p className="ios-empty-title">暂无工单</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Ticket Detail */}
        {activeTab === 'tickets' && selectedTicketId && (
          <div className="space-y-4 ios-fade-in">
            <div className="flex items-center space-x-2">
              <button onClick={() => { setSelectedTicketId(null); setTicketReply(''); }} className="text-[var(--ios-blue)] text-sm font-medium">← 返回</button>
              <h2 className="ios-subtitle text-[var(--ios-label)]">
                {tickets.find(t => t.id === selectedTicketId)?.subject}
              </h2>
            </div>
            <div className="ios-card overflow-hidden">
              <div className="p-4 space-y-3 max-h-96 overflow-y-auto">
                {tickets.find(t => t.id === selectedTicketId)?.messages?.map((msg, i) => (
                  <div key={i} className={`flex ${msg.senderType === 'user' ? 'justify-start' : 'justify-end'}`}>
                    <div className={`max-w-[80%] px-3 py-2 rounded-2xl text-sm ${
                      msg.senderType === 'user'
                        ? 'bg-[var(--ios-fill)] text-[var(--ios-label)] rounded-bl-md'
                        : 'bg-[var(--ios-blue)] text-white rounded-br-md'
                    }`}>
                      <p>{msg.content}</p>
                      <p className="text-[10px] mt-1 opacity-60">{msg.createdAt}</p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="px-4 pb-4 flex space-x-2">
                <input
                  type="text"
                  value={ticketReply}
                  onChange={e => setTicketReply(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleTicketReply()}
                  placeholder="回复工单..."
                  className="ios-input flex-1 text-sm"
                />
                <button onClick={handleTicketReply} disabled={!ticketReply.trim()} className="ios-btn text-sm py-2 px-4">
                  回复
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
