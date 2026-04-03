import { useState, useRef, useEffect } from 'react';
import { useApp } from '../store';
import type { Ticket, TicketStatus, TicketCategory, TicketPriority } from '../types';

type TicketFilter = 'all' | 'open' | 'pending' | 'resolved' | 'closed';
type CategoryFilter = 'all' | 'technical' | 'payment' | 'account' | 'refund' | 'other';
type PriorityFilter = 'all' | 'low' | 'medium' | 'high' | 'urgent';

const STATUS_CONFIG: Record<TicketStatus, { label: string; color: string; bg: string; icon: string }> = {
  open: { label: '待处理', color: 'text-blue-400', bg: 'bg-blue-500/15 border-blue-500/30', icon: '🔵' },
  pending: { label: '处理中', color: 'text-yellow-400', bg: 'bg-yellow-500/15 border-yellow-500/30', icon: '🟡' },
  resolved: { label: '已解决', color: 'text-green-400', bg: 'bg-green-500/15 border-green-500/30', icon: '🟢' },
  closed: { label: '已关闭', color: 'text-gray-400', bg: 'bg-gray-500/15 border-gray-500/30', icon: '⚫' },
};

const CATEGORY_CONFIG: Record<TicketCategory, { label: string; icon: string }> = {
  technical: { label: '技术支持', icon: '🔧' },
  payment: { label: '支付问题', icon: '💳' },
  account: { label: '账号问题', icon: '👤' },
  refund: { label: '退款申请', icon: '💰' },
  other: { label: '其他', icon: '📌' },
};

const PRIORITY_CONFIG: Record<TicketPriority, { label: string; color: string; bg: string }> = {
  low: { label: '低', color: 'text-gray-400', bg: 'bg-gray-500/15' },
  medium: { label: '中', color: 'text-blue-400', bg: 'bg-blue-500/15' },
  high: { label: '高', color: 'text-orange-400', bg: 'bg-orange-500/15' },
  urgent: { label: '紧急', color: 'text-red-400', bg: 'bg-red-500/15' },
};

export default function TicketManagement() {
  const {
    tickets, updateTicket, deleteTicket,
    ticketMessages, replyTicket, assignTicket,
    quickReplies, addQuickReply, deleteQuickReply,
    adminAuth,
  } = useApp();

  const [filter, setFilter] = useState<TicketFilter>('all');
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all');
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTickets, setSelectedTickets] = useState<Set<string>>(new Set());
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [replyContent, setReplyContent] = useState('');
  const [showQuickReplies, setShowQuickReplies] = useState(false);
  const [showNewQuickReply, setShowNewQuickReply] = useState(false);
  const [newQuickReply, setNewQuickReply] = useState({ title: '', content: '', category: 'general' as string });
  const [showNotes, setShowNotes] = useState(false);
  const [notesContent, setNotesContent] = useState('');
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [assignAdmin, setAssignAdmin] = useState('');
  const [showBatchAction, setShowBatchAction] = useState(false);
  const [batchAction, setBatchAction] = useState<'status' | 'assign' | 'delete'>('status');
  const [batchStatus, setBatchStatus] = useState<TicketStatus>('pending');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [ticketMessages.length]);

  // Filter tickets
  const filteredTickets = tickets.filter(t => {
    const matchesStatus = filter === 'all' || t.status === filter;
    const matchesCategory = categoryFilter === 'all' || t.category === categoryFilter;
    const matchesPriority = priorityFilter === 'all' || t.priority === priorityFilter;
    const matchesSearch = searchTerm === '' ||
      t.ticketNo.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.subject.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.userEmail.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesStatus && matchesCategory && matchesPriority && matchesSearch;
  });

  // Sort: urgent first, then by lastReplyAt
  const sortedTickets = [...filteredTickets].sort((a, b) => {
    const priorityOrder = { urgent: 0, high: 1, medium: 2, low: 3 };
    const pa = priorityOrder[a.priority];
    const pb = priorityOrder[b.priority];
    if (pa !== pb) return pa - pb;
    return new Date(b.lastReplyAt).getTime() - new Date(a.lastReplyAt).getTime();
  });

  const ticketMessagesForSelected = ticketMessages.filter(m => selectedTicket && m.ticketId === selectedTicket.id);

  const stats = {
    total: tickets.length,
    open: tickets.filter(t => t.status === 'open').length,
    pending: tickets.filter(t => t.status === 'pending').length,
    resolved: tickets.filter(t => t.status === 'resolved').length,
    closed: tickets.filter(t => t.status === 'closed').length,
    unread: tickets.reduce((sum, t) => sum + t.unreadCount, 0),
    unassigned: tickets.filter(t => !t.assignedAdminId && t.status !== 'closed').length,
  };

  const toggleSelectAll = () => {
    if (selectedTickets.size === sortedTickets.length) {
      setSelectedTickets(new Set());
    } else {
      setSelectedTickets(new Set(sortedTickets.map(t => t.id)));
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedTickets(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleBatchAction = () => {
    if (selectedTickets.size === 0) return;
    if (batchAction === 'status') {
      selectedTickets.forEach(id => updateTicket(id, { status: batchStatus }));
    } else if (batchAction === 'assign' && assignAdmin) {
      selectedTickets.forEach(id => assignTicket(id, assignAdmin));
    } else if (batchAction === 'delete') {
      selectedTickets.forEach(id => deleteTicket(id));
    }
    setSelectedTickets(new Set());
    setShowBatchAction(false);
  };

  const handleReply = () => {
    if (!selectedTicket || !replyContent.trim()) return;
    replyTicket(selectedTicket.id, replyContent, 'admin', adminAuth.admin?.username || 'admin');
    setReplyContent('');
  };

  const insertQuickReply = (content: string) => {
    setReplyContent(prev => prev + (prev ? '\n' : '') + content);
    setShowQuickReplies(false);
  };

  const handleAddQuickReply = () => {
    if (!newQuickReply.title || !newQuickReply.content) return;
    addQuickReply({ title: newQuickReply.title, content: newQuickReply.content, category: newQuickReply.category, isPublic: true });
    setNewQuickReply({ title: '', content: '', category: 'general' });
    setShowNewQuickReply(false);
  };

  const handleSaveNotes = () => {
    if (selectedTicket) {
      updateTicket(selectedTicket.id, { notes: notesContent });
      setShowNotes(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-white">工单管理</h2>
        {selectedTickets.size > 0 && (
          <div className="flex items-center gap-3">
            <span className="text-sm text-violet-400">已选择 {selectedTickets.size} 个工单</span>
            <button
              onClick={() => setShowBatchAction(true)}
              className="rounded-lg bg-violet-600 px-4 py-2 text-sm text-white hover:bg-violet-700 transition"
            >
              批量操作
            </button>
            <button
              onClick={() => setSelectedTickets(new Set())}
              className="text-sm text-gray-400 hover:text-white transition"
            >
              取消选择
            </button>
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        <div className="rounded-xl border border-gray-800 bg-gray-800/50 p-4 text-center">
          <p className="text-2xl font-bold text-white">{stats.total}</p>
          <p className="text-xs text-gray-400 mt-1">全部工单</p>
        </div>
        <div className="rounded-xl border border-blue-500/30 bg-blue-500/10 p-4 text-center">
          <p className="text-2xl font-bold text-blue-400">{stats.open}</p>
          <p className="text-xs text-gray-400 mt-1">待处理</p>
        </div>
        <div className="rounded-xl border border-yellow-500/30 bg-yellow-500/10 p-4 text-center">
          <p className="text-2xl font-bold text-yellow-400">{stats.pending}</p>
          <p className="text-xs text-gray-400 mt-1">处理中</p>
        </div>
        <div className="rounded-xl border border-green-500/30 bg-green-500/10 p-4 text-center">
          <p className="text-2xl font-bold text-green-400">{stats.resolved}</p>
          <p className="text-xs text-gray-400 mt-1">已解决</p>
        </div>
        <div className="rounded-xl border border-gray-700 bg-gray-800/30 p-4 text-center">
          <p className="text-2xl font-bold text-gray-400">{stats.closed}</p>
          <p className="text-xs text-gray-400 mt-1">已关闭</p>
        </div>
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-center">
          <p className="text-2xl font-bold text-red-400">{stats.unread}</p>
          <p className="text-xs text-gray-400 mt-1">未读消息</p>
        </div>
        <div className="rounded-xl border border-orange-500/30 bg-orange-500/10 p-4 text-center">
          <p className="text-2xl font-bold text-orange-400">{stats.unassigned}</p>
          <p className="text-xs text-gray-400 mt-1">未分配</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="text"
          placeholder="🔍 搜索工单号、用户名、邮箱..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="flex-1 min-w-[250px] rounded-lg border border-gray-700 bg-gray-800 px-4 py-2 text-sm text-white placeholder-gray-500 focus:border-violet-500 focus:outline-none"
        />
        <select value={filter} onChange={(e) => setFilter(e.target.value as TicketFilter)}
          className="rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white">
          <option value="all">全部状态</option>
          <option value="open">待处理</option>
          <option value="pending">处理中</option>
          <option value="resolved">已解决</option>
          <option value="closed">已关闭</option>
        </select>
        <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value as CategoryFilter)}
          className="rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white">
          <option value="all">全部类别</option>
          <option value="technical">技术支持</option>
          <option value="payment">支付问题</option>
          <option value="account">账号问题</option>
          <option value="refund">退款申请</option>
          <option value="other">其他</option>
        </select>
        <select value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value as PriorityFilter)}
          className="rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white">
          <option value="all">全部优先级</option>
          <option value="urgent">紧急</option>
          <option value="high">高</option>
          <option value="medium">中</option>
          <option value="low">低</option>
        </select>
      </div>

      {/* Ticket List */}
      <div className="rounded-xl border border-gray-800 bg-gray-800/30 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-700 bg-gray-800/80">
                <th className="px-4 py-3 text-left">
                  <input
                    type="checkbox"
                    checked={selectedTickets.size === sortedTickets.length && sortedTickets.length > 0}
                    onChange={toggleSelectAll}
                    className="rounded border-gray-600 bg-gray-700 text-violet-600 focus:ring-violet-500"
                  />
                </th>
                <th className="px-4 py-3 text-left text-gray-400 font-medium">工单号</th>
                <th className="px-4 py-3 text-left text-gray-400 font-medium">用户</th>
                <th className="px-4 py-3 text-left text-gray-400 font-medium">主题</th>
                <th className="px-4 py-3 text-left text-gray-400 font-medium">类别</th>
                <th className="px-4 py-3 text-left text-gray-400 font-medium">优先级</th>
                <th className="px-4 py-3 text-left text-gray-400 font-medium">状态</th>
                <th className="px-4 py-3 text-left text-gray-400 font-medium">分配</th>
                <th className="px-4 py-3 text-left text-gray-400 font-medium">消息</th>
                <th className="px-4 py-3 text-left text-gray-400 font-medium">最后回复</th>
              </tr>
            </thead>
            <tbody>
              {sortedTickets.map(ticket => (
                <tr
                  key={ticket.id}
                  onClick={() => { setSelectedTicket(ticket); setNotesContent(ticket.notes || ''); }}
                  className={`border-b border-gray-800/50 cursor-pointer transition hover:bg-gray-800/50 ${
                    selectedTicket?.id === ticket.id ? 'bg-violet-500/10' : ''
                  } ${ticket.unreadCount > 0 ? 'bg-blue-500/5' : ''}`}
                >
                  <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={selectedTickets.has(ticket.id)}
                      onChange={() => toggleSelect(ticket.id)}
                      className="rounded border-gray-600 bg-gray-700 text-violet-600 focus:ring-violet-500"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-mono text-xs text-gray-500">{ticket.ticketNo}</span>
                  </td>
                  <td className="px-4 py-3">
                    <div>
                      <p className="font-medium text-white text-xs">{ticket.username}</p>
                      <p className="text-[10px] text-gray-500">{ticket.userEmail}</p>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="max-w-[200px]">
                      <p className="text-sm text-white truncate">{ticket.subject}</p>
                      {ticket.lastMessage && (
                        <p className="text-[10px] text-gray-500 truncate mt-0.5">{ticket.lastMessage}</p>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs">{CATEGORY_CONFIG[ticket.category]?.icon} {CATEGORY_CONFIG[ticket.category]?.label}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${PRIORITY_CONFIG[ticket.priority].bg} ${PRIORITY_CONFIG[ticket.priority].color}`}>
                      {PRIORITY_CONFIG[ticket.priority].label}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${STATUS_CONFIG[ticket.status].bg} ${STATUS_CONFIG[ticket.status].color}`}>
                      {STATUS_CONFIG[ticket.status].label}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {ticket.assignedAdminName ? (
                      <span className="text-xs text-violet-400">{ticket.assignedAdminName}</span>
                    ) : (
                      <span className="text-xs text-gray-500">未分配</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <span className="text-xs text-gray-400">{ticket.messageCount}</span>
                      {ticket.unreadCount > 0 && (
                        <span className="flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[9px] text-white font-bold">
                          {ticket.unreadCount}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs text-gray-500">{new Date(ticket.lastReplyAt).toLocaleDateString('zh-CN')}</span>
                  </td>
                </tr>
              ))}
              {sortedTickets.length === 0 && (
                <tr>
                  <td colSpan={10} className="px-4 py-12 text-center text-gray-500">
                    <p className="text-lg">📭 暂无工单</p>
                    <p className="text-sm mt-1">没有符合筛选条件的工单</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Ticket Detail Panel */}
      {selectedTicket && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-2xl bg-gray-900 border-l border-gray-800 flex flex-col h-full">
            {/* Header */}
            <div className="border-b border-gray-800 p-4 flex-shrink-0">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setSelectedTicket(null)}
                    className="rounded-lg p-2 text-gray-400 hover:bg-gray-800 transition"
                  >
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                  </button>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs text-gray-500">{selectedTicket.ticketNo}</span>
                      <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${STATUS_CONFIG[selectedTicket.status].bg} ${STATUS_CONFIG[selectedTicket.status].color}`}>
                        {STATUS_CONFIG[selectedTicket.status].label}
                      </span>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${PRIORITY_CONFIG[selectedTicket.priority].bg} ${PRIORITY_CONFIG[selectedTicket.priority].color}`}>
                        {PRIORITY_CONFIG[selectedTicket.priority].label}优先级
                      </span>
                    </div>
                    <h3 className="text-lg font-semibold text-white mt-1">{selectedTicket.subject}</h3>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowNotes(!showNotes)}
                    className="rounded-lg border border-gray-700 px-3 py-1.5 text-xs text-gray-400 hover:bg-gray-800 transition"
                  >
                    📝 备注
                  </button>
                  <button
                    onClick={() => setShowAssignModal(true)}
                    className="rounded-lg border border-violet-500/30 px-3 py-1.5 text-xs text-violet-400 hover:bg-violet-500/10 transition"
                  >
                    👤 分配
                  </button>
                  <select
                    value={selectedTicket.status}
                    onChange={(e) => updateTicket(selectedTicket.id, { status: e.target.value as TicketStatus })}
                    className="rounded-lg border border-gray-700 bg-gray-800 px-3 py-1.5 text-xs text-white"
                  >
                    <option value="open">待处理</option>
                    <option value="pending">处理中</option>
                    <option value="resolved">已解决</option>
                    <option value="closed">已关闭</option>
                  </select>
                </div>
              </div>

              {/* User Info */}
              <div className="flex items-center gap-4 text-xs text-gray-400 bg-gray-800/50 rounded-lg p-3">
                <span>👤 {selectedTicket.username}</span>
                <span>📧 {selectedTicket.userEmail}</span>
                {selectedTicket.planName && <span>💎 {selectedTicket.planName}</span>}
                {selectedTicket.assignedAdminName && <span>🔧 分配给: {selectedTicket.assignedAdminName}</span>}
                <span className="ml-auto">📅 {new Date(selectedTicket.createdAt).toLocaleString('zh-CN')}</span>
              </div>
            </div>

            {/* Notes Panel */}
            {showNotes && (
              <div className="border-b border-yellow-500/30 bg-yellow-500/5 p-3 flex-shrink-0">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-yellow-400">📝 管理员内部备注</span>
                  <button onClick={() => setShowNotes(false)} className="text-gray-500 hover:text-white text-xs">关闭</button>
                </div>
                <textarea
                  value={notesContent}
                  onChange={(e) => setNotesContent(e.target.value)}
                  placeholder="添加内部备注（用户不可见）..."
                  rows={2}
                  className="w-full rounded-lg bg-gray-800 border border-gray-700 px-3 py-2 text-sm text-white placeholder-gray-500 focus:border-yellow-500 focus:outline-none resize-none"
                />
                <button
                  onClick={handleSaveNotes}
                  className="mt-2 rounded-lg bg-yellow-600 px-4 py-1.5 text-xs text-white hover:bg-yellow-700 transition"
                >
                  保存备注
                </button>
              </div>
            )}

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {ticketMessagesForSelected.map(msg => (
                <div key={msg.id} className={`flex ${msg.senderType === 'admin' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[80%] rounded-xl px-4 py-3 ${
                    msg.senderType === 'admin'
                      ? 'bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white rounded-br-md'
                      : msg.senderType === 'system'
                      ? 'bg-gray-800 text-gray-400 text-sm rounded-lg'
                      : 'bg-gray-800 text-gray-200 rounded-bl-md'
                  }`}>
                    {msg.senderType !== 'system' && (
                      <p className="text-[10px] opacity-60 mb-1">{msg.senderName} · {msg.senderType === 'admin' ? '管理员' : '用户'}</p>
                    )}
                    <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                    <p className={`text-[10px] mt-1.5 ${msg.senderType === 'admin' ? 'text-white/50' : 'text-gray-500'}`}>
                      {new Date(msg.createdAt).toLocaleString('zh-CN')}
                    </p>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            {/* Reply Area */}
            {selectedTicket.status !== 'closed' && (
              <div className="border-t border-gray-800 p-4 flex-shrink-0">
                {/* Quick Replies */}
                {showQuickReplies && (
                  <div className="mb-3 rounded-xl border border-gray-700 bg-gray-800/50 p-3 max-h-48 overflow-y-auto">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-white">快捷回复</span>
                      <button
                        onClick={() => setShowNewQuickReply(!showNewQuickReply)}
                        className="text-xs text-violet-400 hover:text-violet-300"
                      >
                        + 添加
                      </button>
                    </div>
                    {showNewQuickReply && (
                      <div className="mb-3 p-3 rounded-lg bg-gray-800 space-y-2">
                        <input
                          type="text"
                          placeholder="标题"
                          value={newQuickReply.title}
                          onChange={(e) => setNewQuickReply({ ...newQuickReply, title: e.target.value })}
                          className="w-full rounded-lg bg-gray-900 border border-gray-700 px-3 py-1.5 text-xs text-white placeholder-gray-500"
                        />
                        <textarea
                          placeholder="内容"
                          value={newQuickReply.content}
                          onChange={(e) => setNewQuickReply({ ...newQuickReply, content: e.target.value })}
                          rows={2}
                          className="w-full rounded-lg bg-gray-900 border border-gray-700 px-3 py-1.5 text-xs text-white placeholder-gray-500 resize-none"
                        />
                        <select
                          value={newQuickReply.category}
                          onChange={(e) => setNewQuickReply({ ...newQuickReply, category: e.target.value })}
                          className="w-full rounded-lg bg-gray-900 border border-gray-700 px-3 py-1.5 text-xs text-white"
                        >
                          <option value="general">通用</option>
                          <option value="technical">技术</option>
                          <option value="payment">支付</option>
                          <option value="account">账号</option>
                          <option value="refund">退款</option>
                        </select>
                        <button
                          onClick={handleAddQuickReply}
                          className="rounded-lg bg-violet-600 px-3 py-1 text-xs text-white hover:bg-violet-700"
                        >
                          保存
                        </button>
                      </div>
                    )}
                    <div className="space-y-1">
                      {quickReplies.map(qr => (
                        <div key={qr.id} className="flex items-center justify-between rounded-lg bg-gray-800 p-2 hover:bg-gray-700 group">
                          <button
                            onClick={() => insertQuickReply(qr.content)}
                            className="flex-1 text-left"
                          >
                            <p className="text-xs font-medium text-white">{qr.title}</p>
                            <p className="text-[10px] text-gray-500 truncate">{qr.content}</p>
                          </button>
                          <button
                            onClick={() => deleteQuickReply(qr.id)}
                            className="text-gray-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition text-xs"
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-2 mb-2">
                  <button
                    onClick={() => setShowQuickReplies(!showQuickReplies)}
                    className="rounded-lg border border-gray-700 px-3 py-1.5 text-xs text-gray-400 hover:bg-gray-800 transition"
                  >
                    ⚡ 快捷回复
                  </button>
                </div>

                <div className="flex gap-2">
                  <textarea
                    value={replyContent}
                    onChange={(e) => setReplyContent(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter' && e.ctrlKey) handleReply(); }}
                    placeholder="回复工单... (Ctrl+Enter 发送)"
                    rows={3}
                    className="flex-1 rounded-xl bg-gray-800 border border-gray-700 px-4 py-3 text-sm text-white placeholder-gray-500 focus:border-violet-500 focus:outline-none resize-none"
                  />
                  <button
                    onClick={handleReply}
                    disabled={!replyContent.trim()}
                    className="self-end rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 px-5 py-3 text-sm text-white disabled:opacity-30 hover:opacity-90 transition"
                  >
                    发送
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Batch Action Modal */}
      {showBatchAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur">
          <div className="w-full max-w-md rounded-2xl border border-gray-800 bg-gray-900 p-6">
            <h3 className="text-lg font-semibold text-white mb-4">批量操作 ({selectedTickets.size} 个工单)</h3>
            <div className="space-y-4">
              <select
                value={batchAction}
                onChange={(e) => setBatchAction(e.target.value as 'status' | 'assign' | 'delete')}
                className="w-full rounded-lg border border-gray-700 bg-gray-800 px-4 py-3 text-sm text-white"
              >
                <option value="status">修改状态</option>
                <option value="assign">分配管理员</option>
                <option value="delete">删除工单</option>
              </select>

              {batchAction === 'status' && (
                <select
                  value={batchStatus}
                  onChange={(e) => setBatchStatus(e.target.value as TicketStatus)}
                  className="w-full rounded-lg border border-gray-700 bg-gray-800 px-4 py-3 text-sm text-white"
                >
                  <option value="open">待处理</option>
                  <option value="pending">处理中</option>
                  <option value="resolved">已解决</option>
                  <option value="closed">已关闭</option>
                </select>
              )}

              {batchAction === 'assign' && (
                <input
                  type="text"
                  placeholder="管理员名称"
                  value={assignAdmin}
                  onChange={(e) => setAssignAdmin(e.target.value)}
                  className="w-full rounded-lg border border-gray-700 bg-gray-800 px-4 py-3 text-sm text-white placeholder-gray-500"
                />
              )}

              {batchAction === 'delete' && (
                <p className="text-sm text-red-400">⚠️ 此操作不可恢复，确定要删除这些工单吗？</p>
              )}

              <div className="flex space-x-3">
                <button
                  onClick={handleBatchAction}
                  className="flex-1 rounded-lg bg-violet-600 py-3 text-white hover:bg-violet-700 transition"
                >
                  确认
                </button>
                <button
                  onClick={() => setShowBatchAction(false)}
                  className="flex-1 rounded-lg border border-gray-700 py-3 text-white hover:bg-gray-800 transition"
                >
                  取消
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Assign Modal */}
      {showAssignModal && selectedTicket && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur">
          <div className="w-full max-w-md rounded-2xl border border-gray-800 bg-gray-900 p-6">
            <h3 className="text-lg font-semibold text-white mb-4">分配工单</h3>
            <div className="space-y-4">
              <p className="text-sm text-gray-400">工单: {selectedTicket.ticketNo} - {selectedTicket.subject}</p>
              <input
                type="text"
                placeholder="管理员名称"
                value={assignAdmin}
                onChange={(e) => setAssignAdmin(e.target.value)}
                className="w-full rounded-lg border border-gray-700 bg-gray-800 px-4 py-3 text-sm text-white placeholder-gray-500"
              />
              <div className="flex space-x-3">
                <button
                  onClick={() => {
                    if (assignAdmin) {
                      assignTicket(selectedTicket.id, assignAdmin);
                      setShowAssignModal(false);
                      setAssignAdmin('');
                    }
                  }}
                  className="flex-1 rounded-lg bg-violet-600 py-3 text-white hover:bg-violet-700 transition"
                >
                  确认分配
                </button>
                <button
                  onClick={() => { setShowAssignModal(false); setAssignAdmin(''); }}
                  className="flex-1 rounded-lg border border-gray-700 py-3 text-white hover:bg-gray-800 transition"
                >
                  取消
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
