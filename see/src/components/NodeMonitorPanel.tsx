import { useState, useEffect, useRef } from 'react';
import { useApp } from '../store';

type MonitorView = 'list' | 'detail' | 'chart';

export default function NodeMonitorPanel() {
  const { nodeMonitors, nodes, checkNodeLatency, checkAllNodesLatency } = useApp();
  const [monitorView, setMonitorView] = useState<MonitorView>('list');
  const [isChecking, setIsChecking] = useState(false);
  const [checkProgress, setCheckProgress] = useState(0);
  const [autoMonitor, setAutoMonitor] = useState(false);
  const [monitorInterval, setMonitorInterval] = useState(60);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedNode, setExpandedNode] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // 同步节点数据到监控
  useEffect(() => {
    const existingIds = new Set(nodeMonitors.map(m => m.nodeId));
    const newMonitors = nodes
      .filter(n => !existingIds.has(n.id))
      .map(n => ({
        nodeId: n.id,
        nodeName: n.name,
        server: n.server,
        port: n.port,
        protocol: n.type,
        status: n.isActive ? 'online' as const : 'offline' as const,
        latency: n.latency || 0,
        packetLoss: 0,
        uptime: n.isActive ? 99.9 : 0,
        lastCheck: new Date().toISOString(),
        checkHistory: [],
        country: n.country,
        flag: n.flag,
      }));
    if (newMonitors.length > 0) {
      // Node monitors are managed by the store
    }
  }, [nodes]);

  // 自动监控
  useEffect(() => {
    if (autoMonitor) {
      intervalRef.current = setInterval(() => {
        checkAllNodesLatency();
      }, monitorInterval * 1000);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [autoMonitor, monitorInterval]);

  // 单个节点检测
  const handleCheckNode = async (nodeId: string) => {
    setIsChecking(true);
    await checkNodeLatency(nodeId);
    setIsChecking(false);
  };

  // 全部节点检测
  const handleCheckAll = async () => {
    setIsChecking(true);
    setCheckProgress(0);
    const activeNodes = nodes.filter(n => n.isActive);
    for (let i = 0; i < activeNodes.length; i++) {
      await checkNodeLatency(activeNodes[i].id);
      setCheckProgress(Math.round(((i + 1) / activeNodes.length) * 100));
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    setIsChecking(false);
    setCheckProgress(0);
  };

  // 筛选
  const filteredMonitors = nodeMonitors.filter(m => {
    if (filterStatus !== 'all' && m.status !== filterStatus) return false;
    if (searchTerm && !m.nodeName.toLowerCase().includes(searchTerm.toLowerCase()) && !m.server.toLowerCase().includes(searchTerm.toLowerCase())) return false;
    return true;
  });

  // 统计
  const onlineCount = nodeMonitors.filter(m => m.status === 'online').length;
  const offlineCount = nodeMonitors.filter(m => m.status === 'offline').length;
  const degradedCount = nodeMonitors.filter(m => m.status === 'degraded').length;
  const avgLatency = onlineCount > 0
    ? Math.round(nodeMonitors.filter(m => m.status !== 'offline').reduce((sum, m) => sum + m.latency, 0) / onlineCount)
    : 0;

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'online': return 'bg-green-100 text-green-700 border-green-200';
      case 'offline': return 'bg-red-100 text-red-700 border-red-200';
      case 'degraded': return 'bg-yellow-100 text-yellow-700 border-yellow-200';
      case 'checking': return 'bg-blue-100 text-blue-700 border-blue-200';
      default: return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  const getStatusDot = (status: string) => {
    switch (status) {
      case 'online': return 'bg-green-500';
      case 'offline': return 'bg-red-500';
      case 'degraded': return 'bg-yellow-500';
      default: return 'bg-gray-400';
    }
  };

  const getLatencyColor = (latency: number) => {
    if (latency === 0) return 'text-gray-400';
    if (latency < 50) return 'text-green-600';
    if (latency < 100) return 'text-blue-600';
    if (latency < 200) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getLatencyLabel = (latency: number) => {
    if (latency === 0) return '离线';
    if (latency < 50) return '极佳';
    if (latency < 100) return '良好';
    if (latency < 200) return '一般';
    return '较差';
  };

  // const selectedMonitor = nodeMonitors.find(m => m.nodeId === selectedNodeId);

  return (
    <div className="space-y-6">
      {/* 状态概览 */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-500">总节点</span>
            <span className="text-xl">🌐</span>
          </div>
          <div className="text-3xl font-bold text-gray-900">{nodeMonitors.length}</div>
        </div>
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-500">在线</span>
            <span className="w-3 h-3 rounded-full bg-green-500 animate-pulse" />
          </div>
          <div className="text-3xl font-bold text-green-600">{onlineCount}</div>
        </div>
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-500">降级</span>
            <span className="w-3 h-3 rounded-full bg-yellow-500" />
          </div>
          <div className="text-3xl font-bold text-yellow-600">{degradedCount}</div>
        </div>
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-500">离线</span>
            <span className="w-3 h-3 rounded-full bg-red-500" />
          </div>
          <div className="text-3xl font-bold text-red-600">{offlineCount}</div>
        </div>
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-500">平均延迟</span>
            <span className="text-xl">⚡</span>
          </div>
          <div className="text-3xl font-bold text-blue-600">{avgLatency}<span className="text-sm font-normal text-gray-400">ms</span></div>
        </div>
      </div>

      {/* 工具栏 */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">🔍</span>
              <input
                type="text"
                placeholder="搜索节点名称或服务器..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          <select
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value)}
            className="px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">全部状态</option>
            <option value="online">在线</option>
            <option value="degraded">降级</option>
            <option value="offline">离线</option>
          </select>
          <button
            onClick={handleCheckAll}
            disabled={isChecking}
            className={`px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${isChecking ? 'bg-gray-100 text-gray-400' : 'bg-blue-500 text-white hover:bg-blue-600 active:scale-95'}`}
          >
            {isChecking ? (
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin" />
                检测中 {checkProgress}%
              </span>
            ) : (
              '🔍 全节点检测'
            )}
          </button>
          <button
            onClick={() => setAutoMonitor(!autoMonitor)}
            className={`px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${autoMonitor ? 'bg-green-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
          >
            {autoMonitor ? `⏱️ 监控中 (${monitorInterval}s)` : '⏱️ 开启监控'}
          </button>
          {autoMonitor && (
            <select
              value={monitorInterval}
              onChange={e => setMonitorInterval(Number(e.target.value))}
              className="px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm"
            >
              <option value={30}>30秒</option>
              <option value={60}>1分钟</option>
              <option value={300}>5分钟</option>
              <option value={600}>10分钟</option>
            </select>
          )}
          <div className="flex bg-gray-100 rounded-xl p-1">
            {(['list', 'detail', 'chart'] as MonitorView[]).map(view => (
              <button
                key={view}
                onClick={() => setMonitorView(view)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${monitorView === view ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500'}`}
              >
                {view === 'list' ? '列表' : view === 'detail' ? '详情' : '图表'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 进度条 */}
      {isChecking && (
        <div className="bg-blue-50 rounded-2xl p-4 border border-blue-100">
          <div className="flex items-center gap-3">
            <span className="w-5 h-5 border-2 border-blue-200 border-t-blue-500 rounded-full animate-spin" />
            <span className="text-sm text-blue-700 font-medium">正在检测节点延迟...</span>
            <div className="flex-1 h-2 bg-blue-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-500 rounded-full transition-all duration-300"
                style={{ width: `${checkProgress}%` }}
              />
            </div>
            <span className="text-sm text-blue-600 font-medium">{checkProgress}%</span>
          </div>
        </div>
      )}

      {/* 节点列表视图 */}
      {monitorView === 'list' && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="divide-y divide-gray-50">
            {filteredMonitors.map((monitor) => (
              <div key={monitor.nodeId} className="p-4 hover:bg-gray-50 transition-colors">
                <div className="flex items-center gap-4">
                  {/* 状态点 */}
                  <div className="flex items-center gap-2">
                    <div className={`w-3 h-3 rounded-full ${getStatusDot(monitor.status)} ${monitor.status === 'online' ? 'animate-pulse' : ''}`} />
                    <span className={`px-2 py-0.5 rounded-md text-xs font-medium border ${getStatusColor(monitor.status)}`}>
                      {monitor.status === 'online' ? '在线' : monitor.status === 'offline' ? '离线' : '降级'}
                    </span>
                  </div>

                  {/* 节点信息 */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{monitor.flag}</span>
                      <span className="font-medium text-gray-900 truncate">{monitor.nodeName}</span>
                      <span className="text-xs text-gray-400">{monitor.protocol.toUpperCase()}</span>
                    </div>
                    <div className="text-xs text-gray-400 mt-0.5">{monitor.server}:{monitor.port}</div>
                  </div>

                  {/* 延迟 */}
                  <div className="text-right">
                    <div className={`text-lg font-bold ${getLatencyColor(monitor.latency)}`}>
                      {monitor.latency === 0 ? '-' : `${monitor.latency}ms`}
                    </div>
                    <div className={`text-xs ${getLatencyColor(monitor.latency)}`}>
                      {getLatencyLabel(monitor.latency)}
                    </div>
                  </div>

                  {/* 丢包率 */}
                  <div className="text-right w-20">
                    <div className={`text-sm font-medium ${monitor.packetLoss > 5 ? 'text-red-500' : monitor.packetLoss > 1 ? 'text-yellow-500' : 'text-green-500'}`}>
                      {monitor.packetLoss.toFixed(1)}%
                    </div>
                    <div className="text-xs text-gray-400">丢包率</div>
                  </div>

                  {/* 可用率 */}
                  <div className="text-right w-20">
                    <div className={`text-sm font-medium ${monitor.uptime >= 99 ? 'text-green-500' : monitor.uptime >= 95 ? 'text-yellow-500' : 'text-red-500'}`}>
                      {monitor.uptime.toFixed(1)}%
                    </div>
                    <div className="text-xs text-gray-400">可用率</div>
                  </div>

                  {/* 操作 */}
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleCheckNode(monitor.nodeId)}
                      disabled={isChecking}
                      className="p-2 rounded-lg hover:bg-blue-50 text-gray-400 hover:text-blue-500 transition-colors"
                      title="检测延迟"
                    >
                      ⚡
                    </button>
                    <button
                      onClick={() => setExpandedNode(expandedNode === monitor.nodeId ? null : monitor.nodeId)}
                      className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
                      title="查看详情"
                    >
                      {expandedNode === monitor.nodeId ? '▲' : '▼'}
                    </button>
                  </div>
                </div>

                {/* 展开详情 - 延迟历史 */}
                {expandedNode === monitor.nodeId && (
                  <div className="mt-4 pt-4 border-t border-gray-100">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-sm font-medium text-gray-700">延迟历史 (最近7次)</span>
                      <span className="text-xs text-gray-400">最后检测: {monitor.lastCheck}</span>
                    </div>
                    <div className="flex items-end gap-2 h-24">
                      {monitor.checkHistory.map((entry, i) => (
                        <div key={i} className="flex-1 flex flex-col items-center gap-1">
                          <span className="text-xs text-gray-500">{entry.latency > 0 ? `${entry.latency}ms` : '离线'}</span>
                          <div
                            className={`w-full rounded-t-md transition-all duration-300 ${
                              entry.status === 'offline' ? 'bg-red-300' :
                              entry.latency < 50 ? 'bg-green-400' :
                              entry.latency < 100 ? 'bg-blue-400' :
                              entry.latency < 200 ? 'bg-yellow-400' : 'bg-red-400'
                            }`}
                            style={{ height: `${entry.latency === 0 ? 8 : Math.min(entry.latency / 3, 80)}px` }}
                          />
                          <span className="text-xs text-gray-400">{entry.time}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
          {filteredMonitors.length === 0 && (
            <div className="py-12 text-center text-gray-400">
              <div className="text-4xl mb-3">📡</div>
              <p>暂无监控数据</p>
            </div>
          )}
        </div>
      )}

      {/* 节点详情视图 */}
      {monitorView === 'detail' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredMonitors.map((monitor) => (
            <div key={monitor.nodeId} className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">{monitor.flag}</span>
                  <div>
                    <div className="font-medium text-gray-900">{monitor.nodeName}</div>
                    <div className="text-xs text-gray-400">{monitor.server}:{monitor.port}</div>
                  </div>
                </div>
                <span className={`px-2 py-1 rounded-lg text-xs font-medium border ${getStatusColor(monitor.status)}`}>
                  {monitor.status === 'online' ? '在线' : monitor.status === 'offline' ? '离线' : '降级'}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-3 mb-4">
                <div className="text-center p-2 bg-gray-50 rounded-xl">
                  <div className={`text-lg font-bold ${getLatencyColor(monitor.latency)}`}>
                    {monitor.latency === 0 ? '-' : `${monitor.latency}`}
                  </div>
                  <div className="text-xs text-gray-400">延迟 ms</div>
                </div>
                <div className="text-center p-2 bg-gray-50 rounded-xl">
                  <div className={`text-lg font-bold ${monitor.packetLoss > 5 ? 'text-red-500' : 'text-green-500'}`}>
                    {monitor.packetLoss.toFixed(1)}%
                  </div>
                  <div className="text-xs text-gray-400">丢包率</div>
                </div>
                <div className="text-center p-2 bg-gray-50 rounded-xl">
                  <div className={`text-lg font-bold ${monitor.uptime >= 99 ? 'text-green-500' : 'text-yellow-500'}`}>
                    {monitor.uptime.toFixed(1)}%
                  </div>
                  <div className="text-xs text-gray-400">可用率</div>
                </div>
              </div>

              {/* 延迟历史迷你图 */}
              <div className="mb-3">
                <div className="text-xs text-gray-400 mb-2">延迟趋势</div>
                <div className="flex items-end gap-1 h-12">
                  {monitor.checkHistory.map((entry, i) => (
                    <div
                      key={i}
                      className={`flex-1 rounded-t-sm ${
                        entry.status === 'offline' ? 'bg-red-300' :
                        entry.latency < 50 ? 'bg-green-400' :
                        entry.latency < 100 ? 'bg-blue-400' :
                        entry.latency < 200 ? 'bg-yellow-400' : 'bg-red-400'
                      }`}
                      style={{ height: `${entry.latency === 0 ? 4 : Math.min(entry.latency / 3, 48)}px` }}
                    />
                  ))}
                </div>
              </div>

              <button
                onClick={() => handleCheckNode(monitor.nodeId)}
                disabled={isChecking}
                className="w-full py-2 bg-blue-50 text-blue-600 rounded-xl text-sm font-medium hover:bg-blue-100 transition-colors"
              >
                ⚡ 立即检测
              </button>
            </div>
          ))}
        </div>
      )}

      {/* 图表视图 */}
      {monitorView === 'chart' && (
        <div className="space-y-6">
          {/* 延迟分布 */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">📊 延迟分布</h3>
            <div className="grid grid-cols-4 gap-4">
              {[
                { label: '极佳 (<50ms)', count: filteredMonitors.filter(m => m.latency > 0 && m.latency < 50).length, color: 'bg-green-500' },
                { label: '良好 (50-100ms)', count: filteredMonitors.filter(m => m.latency >= 50 && m.latency < 100).length, color: 'bg-blue-500' },
                { label: '一般 (100-200ms)', count: filteredMonitors.filter(m => m.latency >= 100 && m.latency < 200).length, color: 'bg-yellow-500' },
                { label: '较差 (>200ms)', count: filteredMonitors.filter(m => m.latency >= 200).length, color: 'bg-red-500' },
              ].map(item => (
                <div key={item.label} className="text-center p-4 bg-gray-50 rounded-xl">
                  <div className={`w-12 h-12 rounded-full ${item.color} mx-auto mb-2 flex items-center justify-center text-white font-bold text-lg`}>
                    {item.count}
                  </div>
                  <div className="text-sm text-gray-600">{item.label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* 节点延迟柱状图 */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">📈 各节点延迟对比</h3>
            <div className="space-y-3">
              {filteredMonitors
                .filter(m => m.latency > 0)
                .sort((a, b) => a.latency - b.latency)
                .map(monitor => (
                  <div key={monitor.nodeId} className="flex items-center gap-3">
                    <span className="w-6 text-lg">{monitor.flag}</span>
                    <span className="w-28 text-sm text-gray-700 truncate">{monitor.nodeName}</span>
                    <div className="flex-1 h-6 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-700 ${
                          monitor.latency < 50 ? 'bg-green-500' :
                          monitor.latency < 100 ? 'bg-blue-500' :
                          monitor.latency < 200 ? 'bg-yellow-500' : 'bg-red-500'
                        }`}
                        style={{ width: `${Math.min((monitor.latency / 300) * 100, 100)}%` }}
                      />
                    </div>
                    <span className={`text-sm font-medium w-16 text-right ${getLatencyColor(monitor.latency)}`}>
                      {monitor.latency}ms
                    </span>
                  </div>
                ))}
            </div>
          </div>

          {/* 可用率排行 */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">🏆 可用率排行</h3>
            <div className="space-y-3">
              {filteredMonitors
                .sort((a, b) => b.uptime - a.uptime)
                .map((monitor, index) => (
                  <div key={monitor.nodeId} className="flex items-center gap-3">
                    <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white ${
                      index === 0 ? 'bg-yellow-500' : index === 1 ? 'bg-gray-400' : index === 2 ? 'bg-amber-600' : 'bg-gray-500'
                    }`}>
                      {index + 1}
                    </span>
                    <span className="w-6 text-lg">{monitor.flag}</span>
                    <span className="flex-1 text-sm text-gray-700 truncate">{monitor.nodeName}</span>
                    <div className="w-32 h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${monitor.uptime >= 99 ? 'bg-green-500' : monitor.uptime >= 95 ? 'bg-yellow-500' : 'bg-red-500'}`}
                        style={{ width: `${monitor.uptime}%` }}
                      />
                    </div>
                    <span className={`text-sm font-medium w-14 text-right ${monitor.uptime >= 99 ? 'text-green-500' : monitor.uptime >= 95 ? 'text-yellow-500' : 'text-red-500'}`}>
                      {monitor.uptime.toFixed(1)}%
                    </span>
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
