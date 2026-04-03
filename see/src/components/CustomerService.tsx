import { useState, useRef, useEffect, useCallback } from 'react';
import { useApp } from '../store';
import { TicketCategory } from '../types';

type ChatMessage = {
  id: string;
  sender: 'user' | 'agent' | 'system';
  content: string;
  timestamp: Date;
};

type CSView = 'chat' | 'tickets' | 'faq' | 'contact';

const FAQ_DATA = [
  { q: '如何购买套餐？', a: '在商城页面选择您需要的套餐，点击"立即购买"，选择支付方式完成支付后，套餐会自动开通。' },
  { q: '支持哪些支付方式？', a: '我们支持支付宝当面付和USDT（TRC20/ERC20/BEP20）支付。支付宝即时到账，USDT需要链上确认。' },
  { q: '如何获取订阅链接？', a: '登录后进入用户控制面板，在"订阅链接"标签页选择您使用的客户端类型，即可生成对应的订阅链接或配置文件。' },
  { q: '支持哪些客户端？', a: '支持 Clash.Meta、V2Ray、Shadowrocket、Surge、Quantumult X、Loon、Sing-box、Stash 等所有主流客户端。' },
  { q: '流量用完了怎么办？', a: '您可以续费当前套餐或升级到更高级别的套餐。续费后流量会重新计算。' },
  { q: '节点延迟高怎么办？', a: '在用户面板的"节点列表"中运行延迟测试，选择延迟最低的节点。您也可以联系客服获取优化建议。' },
  { q: '如何退款？', a: '购买后24小时内如未使用可申请退款。请在工单系统中提交退款申请，附上订单号。' },
  { q: '套餐可以升级吗？', a: '可以随时升级到更高级别的套餐，系统会自动计算差价。' },
];

const AUTO_REPLIES: Record<string, string> = {
  '你好': '您好！👋 欢迎来到客服中心，请问有什么可以帮您的？',
  'hello': 'Hello! 👋 Welcome to our customer service. How can I help you?',
  '购买': '您可以在商城页面选择套餐并购买。如需推荐，入门版适合轻度使用，基础版最受欢迎，旗舰版适合重度用户。',
  '支付': '我们支持支付宝和USDT支付。支付宝扫码即时到账，USDT需要链上确认（约1-3分钟）。',
  '退款': '购买后24小时内可申请退款。请提供您的订单号，我会帮您处理。',
  '节点': '我们的节点覆盖全球多个国家和地区，支持多种协议。您可以在用户面板测试节点延迟并选择最优节点。',
  '订阅': '登录后在用户面板的"订阅链接"标签页可以生成各种客户端的订阅链接。',
  '延迟': '节点延迟受多种因素影响。建议在用户面板运行延迟测试，选择延迟最低的节点使用。',
  '速度': '不同套餐有不同速度限制。入门版100Mbps，基础版200Mbps，标准版500Mbps，旗舰版1000Mbps。',
  '套餐': '我们提供4种套餐：入门版¥15.9/月、基础版¥25.9/月、标准版¥35.9/月、旗舰版¥55.9/月。',
  '谢谢': '不客气！😊 如果还有其他问题，随时联系我们。祝您使用愉快！',
  '感谢': '感谢您的支持！🙏 如有任何问题，随时联系我们。',
};

function getAutoReply(message: string): string {
  const lower = message.toLowerCase();
  for (const [key, reply] of Object.entries(AUTO_REPLIES)) {
    if (lower.includes(key.toLowerCase())) return reply;
  }
  return '感谢您的消息！😊 我们的客服团队会尽快回复您。如需即时帮助，请查看常见问题(FAQ)或提交工单。';
}

const categoryMap: Record<string, TicketCategory> = {
  '技术支持': 'technical',
  '支付问题': 'payment',
  '账号问题': 'account',
  '退款申请': 'refund',
  '其他': 'other',
};



export default function CustomerService() {
  const { currentUser, tickets: storeTickets, createTicket, replyTicket } = useApp();
  const [isOpen, setIsOpen] = useState(false);
  const [activeView, setActiveView] = useState<CSView>('chat');
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      sender: 'system',
      content: '👋 欢迎使用在线客服！请选择下方快捷问题或直接输入您的问题。',
      timestamp: new Date(),
    },
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [showNewTicket, setShowNewTicket] = useState(false);
  const [newTicket, setNewTicket] = useState({ subject: '', category: '技术支持', content: '' });
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [ticketReply, setTicketReply] = useState('');
  const [faqOpen, setFaqOpen] = useState<number | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const quickQuestions = ['如何购买套餐？', '支持哪些支付方式？', '如何获取订阅链接？', '节点延迟高怎么办？', '如何退款？'];

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = useCallback(() => {
    if (!inputValue.trim()) return;
    const userMsg: ChatMessage = { id: Date.now().toString(), sender: 'user', content: inputValue.trim(), timestamp: new Date() };
    setMessages(prev => [...prev, userMsg]);
    const question = inputValue.trim();
    setInputValue('');
    setIsTyping(true);
    setTimeout(() => {
      const reply = getAutoReply(question);
      const agentMsg: ChatMessage = { id: (Date.now() + 1).toString(), sender: 'agent', content: reply, timestamp: new Date() };
      setMessages(prev => [...prev, agentMsg]);
      setIsTyping(false);
    }, 800 + Math.random() * 700);
  }, [inputValue]);

  const sendQuickQuestion = useCallback((question: string) => {
    const userMsg: ChatMessage = { id: Date.now().toString(), sender: 'user', content: question, timestamp: new Date() };
    setMessages(prev => [...prev, userMsg]);
    setIsTyping(true);
    setTimeout(() => {
      const reply = getAutoReply(question);
      const agentMsg: ChatMessage = { id: (Date.now() + 1).toString(), sender: 'agent', content: reply, timestamp: new Date() };
      setMessages(prev => [...prev, agentMsg]);
      setIsTyping(false);
    }, 800 + Math.random() * 700);
  }, []);

  const handleCreateTicket = useCallback(() => {
    if (!newTicket.subject.trim() || !newTicket.content.trim()) return;
    const ticket = createTicket({
      subject: newTicket.subject,
      category: categoryMap[newTicket.category] || 'other',
      priority: 'medium',
      content: newTicket.content,
    });
    if (ticket) {
      setNewTicket({ subject: '', category: '技术支持', content: '' });
      setShowNewTicket(false);
    }
  }, [newTicket, createTicket]);

  const handleTicketReply = useCallback(() => {
    if (!ticketReply.trim() || !selectedTicketId || !currentUser) return;
    replyTicket(selectedTicketId, ticketReply, 'user', currentUser.username);
    setTicketReply('');
  }, [ticketReply, selectedTicketId, currentUser, replyTicket]);

  const selectedTicket = storeTickets.find(t => t.id === selectedTicketId);

  const statusLabel = (s: string) => {
    switch (s) {
      case 'open': return '待处理';
      case 'pending': return '处理中';
      case 'resolved': return '已解决';
      case 'closed': return '已关闭';
      default: return s;
    }
  };

  const statusColor = (s: string) => {
    switch (s) {
      case 'open': return 'var(--ios-orange)';
      case 'pending': return 'var(--ios-blue)';
      case 'resolved': return 'var(--ios-green)';
      case 'closed': return 'var(--ios-secondary-label)';
      default: return 'var(--ios-secondary-label)';
    }
  };

  const views: { id: CSView; label: string; icon: string }[] = [
    { id: 'chat', label: '客服', icon: '💬' },
    { id: 'tickets', label: '工单', icon: '📋' },
    { id: 'faq', label: 'FAQ', icon: '❓' },
    { id: 'contact', label: '联系', icon: '📞' },
  ];

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-[var(--ios-blue)] text-white shadow-lg hover:opacity-85 transition-all active:scale-95"
      >
        <span className="text-xl">💬</span>
      </button>
    );
  }

  return (
    <div className="fixed bottom-6 right-6 z-50 w-80 sm:w-96">
      <div className="ios-card overflow-hidden" style={{ maxHeight: 'calc(100vh - 120px)', display: 'flex', flexDirection: 'column' }}>
        {/* Header */}
        <div className="bg-[var(--ios-blue)] px-4 py-3 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center space-x-2">
            <span className="text-white text-lg">💬</span>
            <span className="text-white font-semibold">客服中心</span>
          </div>
          <button onClick={() => setIsOpen(false)} className="text-white/80 hover:text-white text-xl leading-none">×</button>
        </div>

        {/* Tab Bar */}
        <div className="flex border-b border-[var(--ios-separator)] flex-shrink-0">
          {views.map(v => (
            <button
              key={v.id}
              onClick={() => setActiveView(v.id)}
              className={`flex-1 py-2.5 text-xs font-medium transition-colors ${
                activeView === v.id
                  ? 'text-[var(--ios-blue)] border-b-2 border-[var(--ios-blue)]'
                  : 'text-[var(--ios-secondary-label)]'
              }`}
            >
              <span className="block text-base mb-0.5">{v.icon}</span>
              {v.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto" style={{ minHeight: 320, maxHeight: 420 }}>
          {/* Chat View */}
          {activeView === 'chat' && (
            <div className="flex flex-col h-full">
              <div className="flex-1 p-3 space-y-3 overflow-y-auto">
                {messages.map(msg => (
                  <div key={msg.id} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                    {msg.sender === 'system' ? (
                      <div className="w-full text-center text-xs text-[var(--ios-secondary-label)] py-1">{msg.content}</div>
                    ) : (
                      <div className={`max-w-[80%] px-3 py-2 rounded-2xl text-sm ${
                        msg.sender === 'user'
                          ? 'bg-[var(--ios-blue)] text-white rounded-br-md'
                          : 'bg-[var(--ios-fill)] text-[var(--ios-label)] rounded-bl-md'
                      }`}>
                        {msg.content}
                      </div>
                    )}
                  </div>
                ))}
                {isTyping && (
                  <div className="flex justify-start">
                    <div className="bg-[var(--ios-fill)] px-3 py-2 rounded-2xl rounded-bl-md">
                      <div className="flex space-x-1">
                        <div className="w-2 h-2 bg-[var(--ios-secondary-label)] rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                        <div className="w-2 h-2 bg-[var(--ios-secondary-label)] rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                        <div className="w-2 h-2 bg-[var(--ios-secondary-label)] rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                      </div>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
              {/* Quick Questions */}
              <div className="px-3 pb-2 flex flex-wrap gap-1.5">
                {quickQuestions.map((q, i) => (
                  <button key={i} onClick={() => sendQuickQuestion(q)} className="text-xs px-2.5 py-1 rounded-full bg-[var(--ios-fill)] text-[var(--ios-blue)] hover:bg-[var(--ios-blue)] hover:text-white transition-colors">
                    {q}
                  </button>
                ))}
              </div>
              {/* Input */}
              <div className="px-3 pb-3 flex space-x-2">
                <input
                  type="text"
                  value={inputValue}
                  onChange={e => setInputValue(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && sendMessage()}
                  placeholder="输入消息..."
                  className="flex-1 ios-input text-sm py-2"
                />
                <button onClick={sendMessage} disabled={!inputValue.trim()} className="ios-btn px-4 py-2 text-sm">
                  发送
                </button>
              </div>
            </div>
          )}

          {/* Tickets View */}
          {activeView === 'tickets' && (
            <div className="p-3">
              {!showNewTicket && !selectedTicketId && (
                <>
                  <div className="flex justify-between items-center mb-3">
                    <h4 className="font-semibold text-[var(--ios-label)]">我的工单</h4>
                    <button onClick={() => setShowNewTicket(true)} className="text-sm text-[var(--ios-blue)] font-medium">+ 新建</button>
                  </div>
                  {storeTickets.filter(t => t.userId === currentUser?.id).length === 0 ? (
                    <div className="text-center py-8 text-[var(--ios-secondary-label)] text-sm">暂无工单</div>
                  ) : (
                    <div className="space-y-2">
                      {storeTickets.filter(t => t.userId === currentUser?.id).map(ticket => (
                        <div key={ticket.id} onClick={() => setSelectedTicketId(ticket.id)} className="ios-list-item rounded-xl bg-[var(--ios-fill)]">
                          <div className="flex-1">
                            <div className="flex items-center space-x-2">
                              <span className="font-medium text-sm text-[var(--ios-label)]">{ticket.subject}</span>
                              <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: `${statusColor(ticket.status)}20`, color: statusColor(ticket.status) }}>
                                {statusLabel(ticket.status)}
                              </span>
                            </div>
                            <div className="text-xs text-[var(--ios-secondary-label)] mt-1">{ticket.ticketNo} · {ticket.createdAt}</div>
                          </div>
                          <span className="text-[var(--ios-tertiary-label)]">›</span>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}

              {showNewTicket && (
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <button onClick={() => setShowNewTicket(false)} className="text-sm text-[var(--ios-blue)]">← 返回</button>
                    <h4 className="font-semibold text-[var(--ios-label)]">新建工单</h4>
                  </div>
                  <div className="space-y-3">
                    <input type="text" placeholder="工单标题" value={newTicket.subject} onChange={e => setNewTicket(p => ({ ...p, subject: e.target.value }))} className="ios-input text-sm" />
                    <select value={newTicket.category} onChange={e => setNewTicket(p => ({ ...p, category: e.target.value }))} className="ios-input text-sm">
                      <option>技术支持</option>
                      <option>支付问题</option>
                      <option>账号问题</option>
                      <option>退款申请</option>
                      <option>其他</option>
                    </select>
                    <textarea placeholder="详细描述您的问题..." value={newTicket.content} onChange={e => setNewTicket(p => ({ ...p, content: e.target.value }))} className="ios-input text-sm" rows={4} />
                    <button onClick={handleCreateTicket} disabled={!newTicket.subject.trim() || !newTicket.content.trim()} className="ios-btn w-full text-sm">提交工单</button>
                  </div>
                </div>
              )}

              {selectedTicketId && selectedTicket && (
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <button onClick={() => { setSelectedTicketId(null); setTicketReply(''); }} className="text-sm text-[var(--ios-blue)]">← 返回</button>
                    <h4 className="font-semibold text-[var(--ios-label)] text-sm truncate max-w-[200px]">{selectedTicket.subject}</h4>
                  </div>
                  <div className="space-y-2 mb-3 max-h-48 overflow-y-auto">
                    {(selectedTicket.messages || []).map(msg => (
                      <div key={msg.id} className={`flex ${msg.senderType === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[80%] px-3 py-2 rounded-2xl text-xs ${
                          msg.senderType === 'user'
                            ? 'bg-[var(--ios-blue)] text-white rounded-br-md'
                            : 'bg-[var(--ios-fill)] text-[var(--ios-label)] rounded-bl-md'
                        }`}>
                          <div className="font-medium mb-0.5">{msg.senderName}</div>
                          {msg.content}
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="flex space-x-2">
                    <input type="text" value={ticketReply} onChange={e => setTicketReply(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleTicketReply()} placeholder="回复..." className="flex-1 ios-input text-sm py-2" />
                    <button onClick={handleTicketReply} disabled={!ticketReply.trim()} className="ios-btn px-3 py-2 text-xs">回复</button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* FAQ View */}
          {activeView === 'faq' && (
            <div className="p-3 space-y-2">
              {FAQ_DATA.map((faq, i) => (
                <div key={i} className="ios-list rounded-xl overflow-hidden">
                  <button onClick={() => setFaqOpen(faqOpen === i ? null : i)} className="w-full flex items-center justify-between p-3 text-left">
                    <span className="text-sm font-medium text-[var(--ios-label)]">{faq.q}</span>
                    <span className={`transition-transform ${faqOpen === i ? 'rotate-180' : ''}`}>▾</span>
                  </button>
                  {faqOpen === i && (
                    <div className="px-3 pb-3 text-xs text-[var(--ios-secondary-label)] leading-relaxed border-t border-[var(--ios-separator)] pt-2">
                      {faq.a}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Contact View */}
          {activeView === 'contact' && (
            <div className="p-4 space-y-4">
              <div className="text-center">
                <div className="text-3xl mb-2">📞</div>
                <h4 className="font-semibold text-[var(--ios-label)]">联系方式</h4>
                <p className="text-xs text-[var(--ios-secondary-label)] mt-1">7×24小时在线客服</p>
              </div>
              <div className="ios-list">
                {[
                  { icon: '📧', label: '邮箱', value: 'support@rocketstore.com' },
                  { icon: '✈️', label: 'Telegram', value: '@RocketStore' },
                  { icon: '🐦', label: 'Twitter', value: '@RocketStore' },
                  { icon: '💬', label: '微信', value: 'RocketStore_CS' },
                ].map((c, i) => (
                  <div key={i} className="ios-list-item">
                    <span className="text-lg mr-3">{c.icon}</span>
                    <div className="flex-1">
                      <div className="text-sm font-medium text-[var(--ios-label)]">{c.label}</div>
                      <div className="text-xs text-[var(--ios-secondary-label)]">{c.value}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
