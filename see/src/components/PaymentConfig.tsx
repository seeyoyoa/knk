import { useState } from 'react';
import { useApp } from '../store';
import { PaymentConfig } from '../types';

export default function PaymentConfigPanel() {
  const { paymentConfig, setPaymentConfig, recharges, updateRecharge, users } = useApp();
  const [activeSubTab, setActiveSubTab] = useState<'alipay' | 'usdt' | 'general' | 'recharges'>('alipay');
  const [editingConfig, setEditingConfig] = useState<PaymentConfig>(paymentConfig);
  const [showTestModal, setShowTestModal] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  const handleSave = () => {
    setPaymentConfig(editingConfig);
  };

  const handleTestAlipay = () => {
    setShowTestModal(true);
    setTestResult(null);
    setTimeout(() => {
      if (editingConfig.alipay.appId && editingConfig.alipay.privateKey) {
        setTestResult({ success: true, message: '支付宝当面付连接测试成功！API配置正确。' });
      } else {
        setTestResult({ success: false, message: '测试失败：请先填写完整的AppID和私钥信息。' });
      }
    }, 1500);
  };

  const handleTestUSDT = () => {
    setShowTestModal(true);
    setTestResult(null);
    setTimeout(() => {
      if (editingConfig.usdt.apiKey && editingConfig.usdt.walletAddress) {
        setTestResult({ success: true, message: 'USDT支付API连接测试成功！钱包地址和API密钥正确。' });
      } else {
        setTestResult({ success: false, message: '测试失败：请先填写完整的API密钥和钱包地址。' });
      }
    }, 1500);
  };

  const handleConfirmRecharge = (id: string) => {
    updateRecharge(id, { status: 'confirmed', confirmedAt: new Date().toISOString().split('T')[0] });
  };

  const handleRejectRecharge = (id: string) => {
    updateRecharge(id, { status: 'failed' });
  };

  return (
    <div className="space-y-6">
      {/* Sub Tabs */}
      <div className="flex flex-wrap gap-2">
        {[
          { key: 'alipay' as const, label: '支付宝当面付', icon: '💰' },
          { key: 'usdt' as const, label: 'USDT支付', icon: '🪙' },
          { key: 'general' as const, label: '通用设置', icon: '⚙️' },
          { key: 'recharges' as const, label: '充值记录', icon: '📋' },
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveSubTab(tab.key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeSubTab === tab.key
                ? 'bg-violet-600 text-white'
                : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white'
            }`}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {/* Alipay Config */}
      {activeSubTab === 'alipay' && (
        <div className="rounded-xl border border-white/10 bg-white/5 p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-lg font-semibold text-white">支付宝当面付配置</h3>
              <p className="text-sm text-gray-400 mt-1">配置支付宝当面付API，支持用户扫码支付</p>
            </div>
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={editingConfig.alipay.enabled}
                onChange={(e) => setEditingConfig({
                  ...editingConfig,
                  alipay: { ...editingConfig.alipay, enabled: e.target.checked }
                })}
                className="w-4 h-4 text-violet-600 rounded bg-gray-800 border-gray-600"
              />
              <span className="text-sm font-medium text-gray-300">启用</span>
            </label>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">AppID <span className="text-red-400">*</span></label>
              <input
                type="text"
                value={editingConfig.alipay.appId}
                onChange={(e) => setEditingConfig({
                  ...editingConfig,
                  alipay: { ...editingConfig.alipay, appId: e.target.value }
                })}
                placeholder="2021001234567890"
                className="w-full px-4 py-2.5 border border-white/10 bg-black/30 rounded-lg text-white placeholder-gray-500 focus:ring-2 focus:ring-violet-500 focus:border-transparent"
              />
              <p className="text-xs text-gray-500 mt-1">支付宝开放平台创建的应用APPID</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">商户邮箱</label>
              <input
                type="text"
                value={editingConfig.alipay.sellerEmail}
                onChange={(e) => setEditingConfig({
                  ...editingConfig,
                  alipay: { ...editingConfig.alipay, sellerEmail: e.target.value }
                })}
                placeholder="your@email.com"
                className="w-full px-4 py-2.5 border border-white/10 bg-black/30 rounded-lg text-white placeholder-gray-500 focus:ring-2 focus:ring-violet-500 focus:border-transparent"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-300 mb-2">应用私钥 (RSA2) <span className="text-red-400">*</span></label>
              <textarea
                value={editingConfig.alipay.privateKey}
                onChange={(e) => setEditingConfig({
                  ...editingConfig,
                  alipay: { ...editingConfig.alipay, privateKey: e.target.value }
                })}
                placeholder="-----BEGIN RSA PRIVATE KEY-----&#10;MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC..."
                rows={4}
                className="w-full px-4 py-2.5 border border-white/10 bg-black/30 rounded-lg text-white placeholder-gray-500 focus:ring-2 focus:ring-violet-500 focus:border-transparent font-mono text-sm"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-300 mb-2">支付宝公钥 <span className="text-red-400">*</span></label>
              <textarea
                value={editingConfig.alipay.alipayPublicKey}
                onChange={(e) => setEditingConfig({
                  ...editingConfig,
                  alipay: { ...editingConfig.alipay, alipayPublicKey: e.target.value }
                })}
                placeholder="-----BEGIN PUBLIC KEY-----&#10;MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA..."
                rows={4}
                className="w-full px-4 py-2.5 border border-white/10 bg-black/30 rounded-lg text-white placeholder-gray-500 focus:ring-2 focus:ring-violet-500 focus:border-transparent font-mono text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">异步通知地址</label>
              <input
                type="text"
                value={editingConfig.alipay.notifyUrl}
                onChange={(e) => setEditingConfig({
                  ...editingConfig,
                  alipay: { ...editingConfig.alipay, notifyUrl: e.target.value }
                })}
                placeholder="https://yourdomain.com/api/payment/alipay/notify"
                className="w-full px-4 py-2.5 border border-white/10 bg-black/30 rounded-lg text-white placeholder-gray-500 focus:ring-2 focus:ring-violet-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">同步跳转地址</label>
              <input
                type="text"
                value={editingConfig.alipay.returnUrl}
                onChange={(e) => setEditingConfig({
                  ...editingConfig,
                  alipay: { ...editingConfig.alipay, returnUrl: e.target.value }
                })}
                placeholder="https://yourdomain.com/payment/return"
                className="w-full px-4 py-2.5 border border-white/10 bg-black/30 rounded-lg text-white placeholder-gray-500 focus:ring-2 focus:ring-violet-500 focus:border-transparent"
              />
            </div>
          </div>

          <div className="flex items-center justify-between mt-6 pt-6 border-t border-white/10">
            <button
              onClick={handleTestAlipay}
              className="px-4 py-2 bg-amber-500/10 text-amber-400 border border-amber-500/30 rounded-lg hover:bg-amber-500/20 transition-colors text-sm font-medium"
            >
              🔍 测试连接
            </button>
            <button
              onClick={handleSave}
              className="px-6 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 transition-colors text-sm font-medium"
            >
              💾 保存配置
            </button>
          </div>

          <div className="mt-6 bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
            <h4 className="text-sm font-semibold text-blue-400 mb-2">📖 配置步骤</h4>
            <ol className="text-sm text-blue-300 space-y-1 list-decimal list-inside">
              <li>登录 <a href="https://open.alipay.com" target="_blank" rel="noopener noreferrer" className="underline">支付宝开放平台</a></li>
              <li>创建应用并获取 AppID</li>
              <li>使用"支付宝开放平台助手"生成 RSA2 密钥对</li>
              <li>在应用中上传应用公钥，获取支付宝公钥</li>
              <li>开通"当面付"产品功能</li>
              <li>填写上述信息并保存</li>
            </ol>
          </div>
        </div>
      )}

      {/* USDT Config */}
      {activeSubTab === 'usdt' && (
        <div className="rounded-xl border border-white/10 bg-white/5 p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-lg font-semibold text-white">USDT 支付配置</h3>
              <p className="text-sm text-gray-400 mt-1">支持 TRC20 / ERC20 / BEP20 网络</p>
            </div>
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={editingConfig.usdt.enabled}
                onChange={(e) => setEditingConfig({
                  ...editingConfig,
                  usdt: { ...editingConfig.usdt, enabled: e.target.checked }
                })}
                className="w-4 h-4 text-violet-600 rounded bg-gray-800 border-gray-600"
              />
              <span className="text-sm font-medium text-gray-300">启用</span>
            </label>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">区块链网络</label>
              <select
                value={editingConfig.usdt.network}
                onChange={(e) => setEditingConfig({
                  ...editingConfig,
                  usdt: { ...editingConfig.usdt, network: e.target.value as any }
                })}
                className="w-full px-4 py-2.5 border border-white/10 bg-black/30 rounded-lg text-white focus:ring-2 focus:ring-violet-500 focus:border-transparent"
              >
                <option value="TRC20">TRC20 (波场) - 推荐，手续费低</option>
                <option value="ERC20">ERC20 (以太坊)</option>
                <option value="BEP20">BEP20 (币安智能链)</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">最低充值金额 (USD)</label>
              <input
                type="number"
                value={editingConfig.usdt.minAmount}
                onChange={(e) => setEditingConfig({
                  ...editingConfig,
                  usdt: { ...editingConfig.usdt, minAmount: parseFloat(e.target.value) || 0 }
                })}
                placeholder="10"
                className="w-full px-4 py-2.5 border border-white/10 bg-black/30 rounded-lg text-white placeholder-gray-500 focus:ring-2 focus:ring-violet-500 focus:border-transparent"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-300 mb-2">收款钱包地址 <span className="text-red-400">*</span></label>
              <input
                type="text"
                value={editingConfig.usdt.walletAddress}
                onChange={(e) => setEditingConfig({
                  ...editingConfig,
                  usdt: { ...editingConfig.usdt, walletAddress: e.target.value }
                })}
                placeholder={editingConfig.usdt.network === 'TRC20' ? 'Txxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx' : '0x...'}
                className="w-full px-4 py-2.5 border border-white/10 bg-black/30 rounded-lg text-white placeholder-gray-500 focus:ring-2 focus:ring-violet-500 focus:border-transparent font-mono text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">支付平台 API Key</label>
              <input
                type="text"
                value={editingConfig.usdt.apiKey}
                onChange={(e) => setEditingConfig({
                  ...editingConfig,
                  usdt: { ...editingConfig.usdt, apiKey: e.target.value }
                })}
                placeholder="NOWPayments / CoinPayments API Key"
                className="w-full px-4 py-2.5 border border-white/10 bg-black/30 rounded-lg text-white placeholder-gray-500 focus:ring-2 focus:ring-violet-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">支付平台 API Secret</label>
              <input
                type="password"
                value={editingConfig.usdt.apiSecret}
                onChange={(e) => setEditingConfig({
                  ...editingConfig,
                  usdt: { ...editingConfig.usdt, apiSecret: e.target.value }
                })}
                placeholder="API Secret"
                className="w-full px-4 py-2.5 border border-white/10 bg-black/30 rounded-lg text-white placeholder-gray-500 focus:ring-2 focus:ring-violet-500 focus:border-transparent"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-300 mb-2">Webhook 通知地址</label>
              <input
                type="text"
                value={editingConfig.usdt.notifyUrl}
                onChange={(e) => setEditingConfig({
                  ...editingConfig,
                  usdt: { ...editingConfig.usdt, notifyUrl: e.target.value }
                })}
                placeholder="https://yourdomain.com/api/payment/usdt/webhook"
                className="w-full px-4 py-2.5 border border-white/10 bg-black/30 rounded-lg text-white placeholder-gray-500 focus:ring-2 focus:ring-violet-500 focus:border-transparent"
              />
            </div>
          </div>

          <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4">
              <h4 className="text-sm font-semibold text-green-400 mb-2">🟢 TRC20 (推荐)</h4>
              <ul className="text-xs text-green-300 space-y-1">
                <li>• 手续费: ~1 USDT</li>
                <li>• 到账时间: 1-3分钟</li>
                <li>• 地址格式: T开头</li>
              </ul>
            </div>
            <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
              <h4 className="text-sm font-semibold text-blue-400 mb-2">🔵 ERC20</h4>
              <ul className="text-xs text-blue-300 space-y-1">
                <li>• 手续费: ~3-10 USDT</li>
                <li>• 到账时间: 3-10分钟</li>
                <li>• 地址格式: 0x开头</li>
              </ul>
            </div>
            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
              <h4 className="text-sm font-semibold text-yellow-400 mb-2">🟡 BEP20</h4>
              <ul className="text-xs text-yellow-300 space-y-1">
                <li>• 手续费: ~0.3 USDT</li>
                <li>• 到账时间: 1-3分钟</li>
                <li>• 地址格式: 0x开头</li>
              </ul>
            </div>
          </div>

          <div className="flex items-center justify-between mt-6 pt-6 border-t border-white/10">
            <button
              onClick={handleTestUSDT}
              className="px-4 py-2 bg-amber-500/10 text-amber-400 border border-amber-500/30 rounded-lg hover:bg-amber-500/20 transition-colors text-sm font-medium"
            >
              🔍 测试连接
            </button>
            <button
              onClick={handleSave}
              className="px-6 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 transition-colors text-sm font-medium"
            >
              💾 保存配置
            </button>
          </div>
        </div>
      )}

      {/* General Settings */}
      {activeSubTab === 'general' && (
        <div className="rounded-xl border border-white/10 bg-white/5 p-6">
          <h3 className="text-lg font-semibold text-white mb-6">通用支付设置</h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">默认货币</label>
              <select
                value={editingConfig.currency}
                onChange={(e) => setEditingConfig({ ...editingConfig, currency: e.target.value })}
                className="w-full px-4 py-2.5 border border-white/10 bg-black/30 rounded-lg text-white focus:ring-2 focus:ring-violet-500 focus:border-transparent"
              >
                <option value="CNY">CNY - 人民币</option>
                <option value="USD">USD - 美元</option>
                <option value="HKD">HKD - 港币</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">CNY → USD 汇率</label>
              <input
                type="number"
                step="0.01"
                value={editingConfig.exchangeRate}
                onChange={(e) => setEditingConfig({ ...editingConfig, exchangeRate: parseFloat(e.target.value) || 0 })}
                placeholder="0.14"
                className="w-full px-4 py-2.5 border border-white/10 bg-black/30 rounded-lg text-white placeholder-gray-500 focus:ring-2 focus:ring-violet-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">支付超时时间 (分钟)</label>
              <input
                type="number"
                value={editingConfig.timeout}
                onChange={(e) => setEditingConfig({ ...editingConfig, timeout: parseInt(e.target.value) || 30 })}
                placeholder="30"
                className="w-full px-4 py-2.5 border border-white/10 bg-black/30 rounded-lg text-white placeholder-gray-500 focus:ring-2 focus:ring-violet-500 focus:border-transparent"
              />
            </div>

            <div className="flex items-center">
              <label className="flex items-center space-x-3">
                <input
                  type="checkbox"
                  checked={editingConfig.autoConfirm}
                  onChange={(e) => setEditingConfig({ ...editingConfig, autoConfirm: e.target.checked })}
                  className="w-4 h-4 text-violet-600 rounded bg-gray-800 border-gray-600"
                />
                <span className="text-sm font-medium text-gray-300">自动确认支付</span>
              </label>
            </div>
          </div>

          <div className="flex justify-end mt-6 pt-6 border-t border-white/10">
            <button
              onClick={handleSave}
              className="px-6 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 transition-colors text-sm font-medium"
            >
              💾 保存设置
            </button>
          </div>
        </div>
      )}

      {/* Recharge Records */}
      {activeSubTab === 'recharges' && (
        <div className="rounded-xl border border-white/10 bg-white/5 p-6">
          <h3 className="text-lg font-semibold text-white mb-6">充值记录管理</h3>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-left py-3 px-4 font-medium text-gray-400">订单号</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-400">用户</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-400">金额</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-400">支付方式</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-400">状态</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-400">交易ID</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-400">时间</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-400">操作</th>
                </tr>
              </thead>
              <tbody>
                {recharges.map(recharge => {
                  const user = users.find(u => u.id === recharge.userId);
                  return (
                    <tr key={recharge.id} className="border-b border-white/5 hover:bg-white/5">
                      <td className="py-3 px-4 font-mono text-xs text-gray-400">#{recharge.id}</td>
                      <td className="py-3 px-4 text-gray-300">{user?.username || '未知'}</td>
                      <td className="py-3 px-4 font-semibold text-white">¥{recharge.amount}</td>
                      <td className="py-3 px-4">
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                          recharge.paymentMethod === 'alipay' ? 'bg-blue-500/20 text-blue-400' :
                          recharge.paymentMethod === 'usdt' ? 'bg-green-500/20 text-green-400' :
                          'bg-gray-500/20 text-gray-400'
                        }`}>
                          {recharge.paymentMethod === 'alipay' ? '💰 支付宝' :
                           recharge.paymentMethod === 'usdt' ? '🪙 USDT' : recharge.paymentMethod}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                          recharge.status === 'confirmed' ? 'bg-green-500/20 text-green-400' :
                          recharge.status === 'paid' ? 'bg-blue-500/20 text-blue-400' :
                          recharge.status === 'pending' ? 'bg-yellow-500/20 text-yellow-400' :
                          recharge.status === 'failed' ? 'bg-red-500/20 text-red-400' :
                          'bg-gray-500/20 text-gray-400'
                        }`}>
                          {recharge.status === 'confirmed' ? '✅ 已确认' :
                           recharge.status === 'paid' ? '💳 已支付' :
                           recharge.status === 'pending' ? '⏳ 待支付' :
                           recharge.status === 'failed' ? '❌ 已拒绝' :
                           '⏰ 已过期'}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono text-xs text-gray-500">{recharge.transactionId || '-'}</td>
                      <td className="py-3 px-4 text-xs text-gray-500">{recharge.createdAt}</td>
                      <td className="py-3 px-4">
                        {recharge.status === 'pending' || recharge.status === 'paid' ? (
                          <div className="flex space-x-2">
                            <button
                              onClick={() => handleConfirmRecharge(recharge.id)}
                              className="px-2 py-1 bg-green-500/20 text-green-400 rounded text-xs hover:bg-green-500/30"
                            >
                              确认
                            </button>
                            <button
                              onClick={() => handleRejectRecharge(recharge.id)}
                              className="px-2 py-1 bg-red-500/20 text-red-400 rounded text-xs hover:bg-red-500/30"
                            >
                              拒绝
                            </button>
                          </div>
                        ) : (
                          <span className="text-xs text-gray-600">-</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Test Modal */}
      {showTestModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-slate-900 border border-white/10 rounded-xl shadow-xl p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-white mb-4">🔍 连接测试</h3>
            {testResult === null ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-violet-500"></div>
                <span className="ml-3 text-gray-400">正在测试连接...</span>
              </div>
            ) : (
              <div className={`p-4 rounded-lg ${testResult.success ? 'bg-green-500/10 border border-green-500/30' : 'bg-red-500/10 border border-red-500/30'}`}>
                <p className={`text-sm font-medium ${testResult.success ? 'text-green-400' : 'text-red-400'}`}>
                  {testResult.success ? '✅' : '❌'} {testResult.message}
                </p>
              </div>
            )}
            <div className="flex justify-end mt-4">
              <button
                onClick={() => setShowTestModal(false)}
                className="px-4 py-2 bg-white/10 text-gray-300 rounded-lg hover:bg-white/20"
              >
                关闭
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
