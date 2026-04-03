import { useState, useEffect } from 'react';
import { useApp } from '../store';
import { TrafficRanking } from '../types';

type SortField = 'rank' | 'dataUsed' | 'usagePercent' | 'totalSpent' | 'orderCount' | 'lastActive';
type SortOrder = 'asc' | 'desc';

export default function TrafficRankingPanel() {
  const { trafficRankings, setTrafficRankings, users, orders } = useApp();
  const [sortField, setSortField] = useState<SortField>('dataUsed');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterPlan, setFilterPlan] = useState<string>('all');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [selectedRankings, setSelectedRankings] = useState<Set<string>>(new Set());

  // 计算流量排行数据
  const computeRankings = () => {
    setIsRefreshing(true);
    setTimeout(() => {
      const rankings: TrafficRanking[] = users.map(user => {
        const plan = user.plan;
        const userOrders = orders.filter(o => o.userId === user.id);
        const totalSpent = userOrders.filter(o => o.status === 'completed').reduce((sum, o) => sum + o.amount, 0);
        return {
          id: user.id,
          userId: user.id,
          username: user.username,
          email: user.email,
          planName: plan?.name || '无套餐',
          dataUsed: user.dataUsed,
          dataLimit: plan?.dataLimit || 0,
          usagePercent: plan?.dataLimit ? Math.round((user.dataUsed / plan.dataLimit) * 100) : 0,
          orderCount: userOrders.length,
          totalSpent,
          lastActive: user.lastLogin || user.createdAt,
          rank: 0,
        };
      }).sort((a, b) => b.dataUsed - a.dataUsed).map((item, index) => ({ ...item, rank: index + 1 }));

      setTrafficRankings(rankings);
      setIsRefreshing(false);
    }, 500);
  };

  // 自动刷新
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(computeRankings, 30000);
    return () => clearInterval(interval);
  }, [autoRefresh]);

  // 筛选和排序
  const filteredRankings = trafficRankings
    .filter(r => {
      if (searchTerm && !r.username.toLowerCase().includes(searchTerm.toLowerCase()) && !r.email.toLowerCase().includes(searchTerm.toLowerCase())) return false;
      if (filterPlan !== 'all' && r.planName !== filterPlan) return false;
      return true;
    })
    .sort((a, b) => {
      const multiplier = sortOrder === 'asc' ? 1 : -1;
      switch (sortField) {
        case 'rank': return (a.rank - b.rank) * multiplier;
        case 'dataUsed': return (a.dataUsed - b.dataUsed) * multiplier;
        case 'usagePercent': return (a.usagePercent - b.usagePercent) * multiplier;
        case 'totalSpent': return (a.totalSpent - b.totalSpent) * multiplier;
        case 'orderCount': return (a.orderCount - b.orderCount) * multiplier;
        case 'lastActive': return (new Date(a.lastActive).getTime() - new Date(b.lastActive).getTime()) * multiplier;
        default: return 0;
      }
    });

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedRankings(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedRankings.size === filteredRankings.length) {
      setSelectedRankings(new Set());
    } else {
      setSelectedRankings(new Set(filteredRankings.map(r => r.id)));
    }
  };

  const getUsageColor = (percent: number) => {
    if (percent >= 90) return 'from-red-500 to-red-600';
    if (percent >= 70) return 'from-orange-500 to-orange-600';
    if (percent >= 50) return 'from-yellow-500 to-yellow-600';
    return 'from-blue-500 to-blue-600';
  };

  const getRankBadge = (rank: number) => {
    if (rank === 1) return 'bg-gradient-to-r from-yellow-400 to-yellow-500 text-white';
    if (rank === 2) return 'bg-gradient-to-r from-gray-300 to-gray-400 text-white';
    if (rank === 3) return 'bg-gradient-to-r from-amber-600 to-amber-700 text-white';
    return 'bg-gray-600 text-gray-200';
  };

  const SortIcon = ({ field }: { field: SortField }) => (
    <span className="ml-1 text-xs opacity-60">
      {sortField === field ? (sortOrder === 'asc' ? '↑' : '↓') : '↕'}
    </span>
  );

  // 统计数据
  const totalTraffic = trafficRankings.reduce((sum, r) => sum + r.dataUsed, 0);
  const avgUsage = trafficRankings.length > 0 ? Math.round(trafficRankings.reduce((sum, r) => sum + r.usagePercent, 0) / trafficRankings.length) : 0;
  const highUsageUsers = trafficRankings.filter(r => r.usagePercent >= 80).length;
  const totalRevenue = trafficRankings.reduce((sum, r) => sum + r.totalSpent, 0);

  const uniquePlans = [...new Set(trafficRankings.map(r => r.planName))];

  return (
    <div className="space-y-6">
      {/* 统计卡片 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-gray-500">总流量消耗</span>
            <span className="text-2xl">📊</span>
          </div>
          <div className="text-2xl font-bold text-gray-900">{totalTraffic.toFixed(1)} GB</div>
          <div className="text-xs text-gray-400 mt-1">{trafficRankings.length} 个用户</div>
        </div>
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-gray-500">平均使用率</span>
            <span className="text-2xl">📈</span>
          </div>
          <div className="text-2xl font-bold text-gray-900">{avgUsage}%</div>
          <div className="text-xs text-gray-400 mt-1">套餐流量占比</div>
        </div>
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-gray-500">高用量用户</span>
            <span className="text-2xl">⚠️</span>
          </div>
          <div className="text-2xl font-bold text-gray-900">{highUsageUsers}</div>
          <div className="text-xs text-gray-400 mt-1">使用率 ≥ 80%</div>
        </div>
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-gray-500">总收入</span>
            <span className="text-2xl">💰</span>
          </div>
          <div className="text-2xl font-bold text-gray-900">¥{totalRevenue.toFixed(2)}</div>
          <div className="text-xs text-gray-400 mt-1">累计消费</div>
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
                placeholder="搜索用户名或邮箱..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>
          <select
            value={filterPlan}
            onChange={e => setFilterPlan(e.target.value)}
            className="px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">全部套餐</option>
            {uniquePlans.map(plan => (
              <option key={plan} value={plan}>{plan}</option>
            ))}
          </select>
          <button
            onClick={computeRankings}
            disabled={isRefreshing}
            className={`px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${isRefreshing ? 'bg-gray-100 text-gray-400' : 'bg-blue-500 text-white hover:bg-blue-600 active:scale-95'}`}
          >
            {isRefreshing ? (
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin" />
                刷新中...
              </span>
            ) : (
              '🔄 刷新数据'
            )}
          </button>
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${autoRefresh ? 'bg-green-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
          >
            {autoRefresh ? '⏱️ 自动刷新: 开' : '⏱️ 自动刷新: 关'}
          </button>
        </div>
      </div>

      {/* 排行表格 */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="px-4 py-3 text-left">
                  <input
                    type="checkbox"
                    checked={selectedRankings.size === filteredRankings.length && filteredRankings.length > 0}
                    onChange={toggleSelectAll}
                    className="w-4 h-4 rounded border-gray-300 text-blue-500 focus:ring-blue-500"
                  />
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider cursor-pointer hover:text-gray-700" onClick={() => handleSort('rank')}>
                  排名<SortIcon field="rank" />
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  用户
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  套餐
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider cursor-pointer hover:text-gray-700" onClick={() => handleSort('dataUsed')}>
                  已用流量<SortIcon field="dataUsed" />
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider cursor-pointer hover:text-gray-700" onClick={() => handleSort('usagePercent')}>
                  使用率<SortIcon field="usagePercent" />
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider cursor-pointer hover:text-gray-700" onClick={() => handleSort('orderCount')}>
                  订单数<SortIcon field="orderCount" />
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider cursor-pointer hover:text-gray-700" onClick={() => handleSort('totalSpent')}>
                  总消费<SortIcon field="totalSpent" />
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider cursor-pointer hover:text-gray-700" onClick={() => handleSort('lastActive')}>
                  最后活跃<SortIcon field="lastActive" />
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  操作
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filteredRankings.map((ranking) => (
                <tr key={ranking.id} className={`hover:bg-gray-50 transition-colors ${selectedRankings.has(ranking.id) ? 'bg-blue-50' : ''}`}>
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selectedRankings.has(ranking.id)}
                      onChange={() => toggleSelect(ranking.id)}
                      className="w-4 h-4 rounded border-gray-300 text-blue-500 focus:ring-blue-500"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold ${getRankBadge(ranking.rank)}`}>
                      {ranking.rank}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div>
                      <div className="font-medium text-gray-900">{ranking.username}</div>
                      <div className="text-xs text-gray-400">{ranking.email}</div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium bg-blue-50 text-blue-700">
                      {ranking.planName}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900">{ranking.dataUsed.toFixed(1)} GB</div>
                    <div className="text-xs text-gray-400">/ {ranking.dataLimit} GB</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden min-w-[80px]">
                        <div
                          className={`h-full rounded-full bg-gradient-to-r ${getUsageColor(ranking.usagePercent)} transition-all duration-500`}
                          style={{ width: `${Math.min(ranking.usagePercent, 100)}%` }}
                        />
                      </div>
                      <span className={`text-xs font-medium ${ranking.usagePercent >= 90 ? 'text-red-500' : ranking.usagePercent >= 70 ? 'text-orange-500' : 'text-gray-500'}`}>
                        {ranking.usagePercent}%
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">{ranking.orderCount}</td>
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">¥{ranking.totalSpent.toFixed(2)}</td>
                  <td className="px-4 py-3 text-xs text-gray-500">{ranking.lastActive}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <button className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-blue-500 transition-colors" title="查看详情">
                        👁️
                      </button>
                      <button className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-orange-500 transition-colors" title="限制速度">
                        ⚡
                      </button>
                      <button className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-red-500 transition-colors" title="暂停使用">
                        ⏸️
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filteredRankings.length === 0 && (
          <div className="py-12 text-center text-gray-400">
            <div className="text-4xl mb-3">📭</div>
            <p>暂无数据</p>
          </div>
        )}
      </div>

      {/* 流量分布图 */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">📊 流量分布 TOP 10</h3>
        <div className="space-y-3">
          {filteredRankings.slice(0, 10).map((ranking) => (
            <div key={ranking.id} className="flex items-center gap-3">
              <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white ${getRankBadge(ranking.rank)}`}>
                {ranking.rank}
              </span>
              <span className="w-20 text-sm font-medium text-gray-700 truncate">{ranking.username}</span>
              <div className="flex-1 h-6 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full bg-gradient-to-r ${getUsageColor(ranking.usagePercent)} transition-all duration-700 flex items-center justify-end pr-2`}
                  style={{ width: `${Math.min(ranking.usagePercent, 100)}%` }}
                >
                  <span className="text-xs font-medium text-white">{ranking.dataUsed.toFixed(1)} GB</span>
                </div>
              </div>
              <span className="text-xs text-gray-400 w-12 text-right">{ranking.usagePercent}%</span>
            </div>
          ))}
        </div>
      </div>

      {/* 批量操作 */}
      {selectedRankings.size > 0 && (
        <div className="bg-blue-50 rounded-2xl p-4 border border-blue-100">
          <div className="flex items-center justify-between">
            <span className="text-sm text-blue-700 font-medium">
              已选择 {selectedRankings.size} 个用户
            </span>
            <div className="flex items-center gap-2">
              <button className="px-3 py-1.5 bg-white rounded-lg text-sm text-blue-600 hover:bg-blue-100 transition-colors border border-blue-200">
                批量限速
              </button>
              <button className="px-3 py-1.5 bg-white rounded-lg text-sm text-blue-600 hover:bg-blue-100 transition-colors border border-blue-200">
                批量发送通知
              </button>
              <button className="px-3 py-1.5 bg-white rounded-lg text-sm text-red-600 hover:bg-red-100 transition-colors border border-red-200">
                批量暂停
              </button>
              <button
                onClick={() => setSelectedRankings(new Set())}
                className="px-3 py-1.5 bg-white rounded-lg text-sm text-gray-600 hover:bg-gray-100 transition-colors border border-gray-200"
              >
                取消选择
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
