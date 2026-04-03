import { useState } from 'react';
import { useApp } from '../store';

export default function EmailConfigPanel() {
  const { emailConfig, updateEmailConfig, testEmailConfig } = useApp();
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    const success = await testEmailConfig();
    setTestResult({
      success,
      message: success ? '邮件发送测试成功！请检查收件箱' : '邮件发送测试失败，请检查配置',
    });
    setTesting(false);
  };

  const commonProviders = [
    { name: 'QQ邮箱', host: 'smtp.qq.com', port: 465, secure: true, help: '需在QQ邮箱设置中开启SMTP服务，获取授权码' },
    { name: '163邮箱', host: 'smtp.163.com', port: 465, secure: true, help: '需在163邮箱设置中开启SMTP服务，获取授权码' },
    { name: 'Gmail', host: 'smtp.gmail.com', port: 465, secure: true, help: '需开启两步验证并生成应用专用密码' },
    { name: 'Outlook', host: 'smtp-mail.outlook.com', port: 587, secure: false, help: '使用Outlook邮箱密码或应用密码' },
    { name: '腾讯企业邮箱', host: 'smtp.exmail.qq.com', port: 465, secure: true, help: '企业微信管理员后台获取SMTP密码' },
    { name: '阿里企业邮箱', host: 'smtp.qiye.aliyun.com', port: 465, secure: true, help: '阿里邮箱管理后台获取SMTP密码' },
  ];

  return (
    <div className="space-y-6">
      {/* 启用开关 */}
      <div className="rounded-xl border border-gray-800 bg-gray-800/50 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-white">📧 邮件服务</h3>
            <p className="text-sm text-gray-400 mt-1">配置SMTP邮件服务器，用于发送注册验证码、通知等邮件</p>
          </div>
          <button
            onClick={() => updateEmailConfig({ isEnabled: !emailConfig.isEnabled })}
            className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors ${
              emailConfig.isEnabled ? 'bg-green-500' : 'bg-gray-700'
            }`}
          >
            <span
              className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
                emailConfig.isEnabled ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>
        <div className={`mt-3 rounded-lg p-3 text-sm ${
          emailConfig.isEnabled
            ? 'bg-green-500/10 border border-green-500/30 text-green-400'
            : 'bg-yellow-500/10 border border-yellow-500/30 text-yellow-400'
        }`}>
          {emailConfig.isEnabled ? '✅ 邮件验证已启用 - 用户注册时需要验证邮箱' : '⚠️ 邮件验证未启用 - 用户注册无需邮箱验证'}
        </div>
      </div>

      {/* 常用邮箱服务商 */}
      <div className="rounded-xl border border-gray-800 bg-gray-800/50 p-6">
        <h3 className="text-lg font-semibold text-white mb-4">📮 常用邮箱服务商配置</h3>
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {commonProviders.map((provider) => (
            <button
              key={provider.name}
              onClick={() => {
                updateEmailConfig({
                  smtpHost: provider.host,
                  smtpPort: provider.port,
                  smtpSecure: provider.secure,
                });
                setTestResult(null);
              }}
              className="rounded-lg border border-gray-700 bg-gray-900/50 p-4 text-left hover:border-violet-500 hover:bg-violet-500/5 transition-all group"
            >
              <div className="font-medium text-white group-hover:text-violet-400">{provider.name}</div>
              <div className="text-xs text-gray-500 mt-1">{provider.host}:{provider.port}</div>
              <div className="text-xs text-gray-600 mt-2 leading-relaxed">{provider.help}</div>
            </button>
          ))}
        </div>
      </div>

      {/* SMTP 配置 */}
      <div className="rounded-xl border border-gray-800 bg-gray-800/50 p-6">
        <h3 className="text-lg font-semibold text-white mb-4">⚙️ SMTP 服务器配置</h3>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="block text-sm text-gray-400 mb-1">SMTP 服务器地址</label>
            <input
              type="text"
              value={emailConfig.smtpHost}
              onChange={(e) => { updateEmailConfig({ smtpHost: e.target.value }); setTestResult(null); }}
              placeholder="例如: smtp.qq.com"
              className="w-full rounded-lg border border-gray-700 bg-gray-900 px-4 py-3 text-white placeholder-gray-600 focus:border-violet-500 focus:outline-none"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-gray-400 mb-1">端口</label>
              <input
                type="number"
                value={emailConfig.smtpPort}
                onChange={(e) => { updateEmailConfig({ smtpPort: parseInt(e.target.value) }); setTestResult(null); }}
                className="w-full rounded-lg border border-gray-700 bg-gray-900 px-4 py-3 text-white focus:border-violet-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">加密方式</label>
              <select
                value={emailConfig.smtpSecure ? 'ssl' : 'tls'}
                onChange={(e) => {
                  updateEmailConfig({ smtpSecure: e.target.value === 'ssl', smtpPort: e.target.value === 'ssl' ? 465 : 587 });
                  setTestResult(null);
                }}
                className="w-full rounded-lg border border-gray-700 bg-gray-900 px-4 py-3 text-white focus:border-violet-500 focus:outline-none"
              >
                <option value="ssl">SSL (465)</option>
                <option value="tls">STARTTLS (587)</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">SMTP 用户名 / 邮箱</label>
            <input
              type="text"
              value={emailConfig.smtpUser}
              onChange={(e) => { updateEmailConfig({ smtpUser: e.target.value }); setTestResult(null); }}
              placeholder="例如: your@email.com"
              className="w-full rounded-lg border border-gray-700 bg-gray-900 px-4 py-3 text-white placeholder-gray-600 focus:border-violet-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">SMTP 密码 / 授权码</label>
            <input
              type="password"
              value={emailConfig.smtpPass}
              onChange={(e) => { updateEmailConfig({ smtpPass: e.target.value }); setTestResult(null); }}
              placeholder="邮箱密码或SMTP授权码"
              className="w-full rounded-lg border border-gray-700 bg-gray-900 px-4 py-3 text-white placeholder-gray-600 focus:border-violet-500 focus:outline-none"
            />
          </div>
        </div>
      </div>

      {/* 发件人信息 */}
      <div className="rounded-xl border border-gray-800 bg-gray-800/50 p-6">
        <h3 className="text-lg font-semibold text-white mb-4">📤 发件人信息</h3>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="block text-sm text-gray-400 mb-1">发件人名称</label>
            <input
              type="text"
              value={emailConfig.fromName}
              onChange={(e) => updateEmailConfig({ fromName: e.target.value })}
              placeholder="例如: RocketStore"
              className="w-full rounded-lg border border-gray-700 bg-gray-900 px-4 py-3 text-white placeholder-gray-600 focus:border-violet-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">发件人邮箱</label>
            <input
              type="email"
              value={emailConfig.fromEmail}
              onChange={(e) => updateEmailConfig({ fromEmail: e.target.value })}
              placeholder="例如: noreply@rocketstore.com"
              className="w-full rounded-lg border border-gray-700 bg-gray-900 px-4 py-3 text-white placeholder-gray-600 focus:border-violet-500 focus:outline-none"
            />
          </div>
        </div>
      </div>

      {/* 验证码设置 */}
      <div className="rounded-xl border border-gray-800 bg-gray-800/50 p-6">
        <h3 className="text-lg font-semibold text-white mb-4">🔐 验证码设置</h3>
        <div className="grid gap-4 md:grid-cols-3">
          <div>
            <label className="block text-sm text-gray-400 mb-1">验证码长度</label>
            <select
              value={emailConfig.codeLength}
              onChange={(e) => updateEmailConfig({ codeLength: parseInt(e.target.value) })}
              className="w-full rounded-lg border border-gray-700 bg-gray-900 px-4 py-3 text-white focus:border-violet-500 focus:outline-none"
            >
              <option value={4}>4 位</option>
              <option value={6}>6 位</option>
              <option value={8}>8 位</option>
            </select>
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">有效期（分钟）</label>
            <input
              type="number"
              value={emailConfig.codeExpiry}
              onChange={(e) => updateEmailConfig({ codeExpiry: parseInt(e.target.value) })}
              min={1}
              max={30}
              className="w-full rounded-lg border border-gray-700 bg-gray-900 px-4 py-3 text-white focus:border-violet-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">最大尝试次数</label>
            <input
              type="number"
              value={emailConfig.maxAttempts}
              onChange={(e) => updateEmailConfig({ maxAttempts: parseInt(e.target.value) })}
              min={1}
              max={10}
              className="w-full rounded-lg border border-gray-700 bg-gray-900 px-4 py-3 text-white focus:border-violet-500 focus:outline-none"
            />
          </div>
        </div>
      </div>

      {/* 邮件模板 */}
      <div className="rounded-xl border border-gray-800 bg-gray-800/50 p-6">
        <h3 className="text-lg font-semibold text-white mb-4">📝 邮件模板</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">邮件主题</label>
            <input
              type="text"
              value={emailConfig.verifySubject}
              onChange={(e) => updateEmailConfig({ verifySubject: e.target.value })}
              placeholder="【RocketStore】邮箱验证码"
              className="w-full rounded-lg border border-gray-700 bg-gray-900 px-4 py-3 text-white placeholder-gray-600 focus:border-violet-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">
              HTML 模板
              <span className="ml-2 text-xs text-gray-500">使用 {'{code}'} 表示验证码，{'{expiry}'} 表示有效期</span>
            </label>
            <textarea
              value={emailConfig.verifyTemplate}
              onChange={(e) => updateEmailConfig({ verifyTemplate: e.target.value })}
              rows={8}
              className="w-full rounded-lg border border-gray-700 bg-gray-900 px-4 py-3 text-white placeholder-gray-600 focus:border-violet-500 focus:outline-none font-mono text-sm"
            />
          </div>
        </div>
      </div>

      {/* 测试和状态 */}
      <div className="rounded-xl border border-gray-800 bg-gray-800/50 p-6">
        <h3 className="text-lg font-semibold text-white mb-4">🧪 测试与状态</h3>
        <div className="flex items-center space-x-4 mb-4">
          <button
            onClick={handleTest}
            disabled={testing || !emailConfig.smtpHost || !emailConfig.smtpUser}
            className="rounded-lg bg-violet-600 px-6 py-3 text-white hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
          >
            {testing ? (
              <>
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                <span>发送测试邮件...</span>
              </>
            ) : (
              <span>发送测试邮件</span>
            )}
          </button>
        </div>

        {testResult && (
          <div className={`rounded-lg p-3 text-sm ${
            testResult.success
              ? 'bg-green-500/10 border border-green-500/30 text-green-400'
              : 'bg-red-500/10 border border-red-500/30 text-red-400'
          }`}>
            {testResult.success ? '✅' : '❌'} {testResult.message}
          </div>
        )}

        {emailConfig.lastTestTime && (
          <div className="mt-3 text-xs text-gray-500">
            上次测试: {new Date(emailConfig.lastTestTime).toLocaleString('zh-CN')}
            {emailConfig.lastTestStatus === 'success' && <span className="ml-2 text-green-400">✓ 成功</span>}
            {emailConfig.lastTestStatus === 'failed' && <span className="ml-2 text-red-400">✗ 失败</span>}
            {emailConfig.lastTestError && <span className="ml-2 text-red-400">- {emailConfig.lastTestError}</span>}
          </div>
        )}
      </div>

      {/* 使用说明 */}
      <div className="rounded-xl border border-blue-500/30 bg-blue-500/10 p-6">
        <h3 className="text-lg font-semibold text-blue-300 mb-3">📖 配置说明</h3>
        <div className="space-y-2 text-sm text-gray-300">
          <p><strong className="text-white">1. QQ邮箱配置步骤：</strong></p>
          <ul className="list-disc list-inside space-y-1 text-gray-400 ml-2">
            <li>登录 QQ邮箱 → 设置 → 账户</li>
            <li>找到 POP3/SMTP 服务，点击"开启"</li>
            <li>按提示发送短信获取授权码</li>
            <li>SMTP服务器: smtp.qq.com，端口: 465，加密: SSL</li>
            <li>用户名: QQ邮箱地址，密码: 授权码（非QQ密码）</li>
          </ul>
          <p className="mt-3"><strong className="text-white">2. Gmail配置步骤：</strong></p>
          <ul className="list-disc list-inside space-y-1 text-gray-400 ml-2">
            <li>登录 Google账号 → 管理Google账号 → 安全性</li>
            <li>开启两步验证</li>
            <li>生成应用专用密码（选择"邮件"和应用名称）</li>
            <li>SMTP服务器: smtp.gmail.com，端口: 465，加密: SSL</li>
            <li>用户名: Gmail地址，密码: 应用专用密码</li>
          </ul>
          <p className="mt-3"><strong className="text-white">3. 模板变量说明：</strong></p>
          <ul className="list-disc list-inside space-y-1 text-gray-400 ml-2">
            <li><code className="bg-gray-800 px-1 rounded">{'{code}'}</code> - 6位数字验证码</li>
            <li><code className="bg-gray-800 px-1 rounded">{'{expiry}'}</code> - 验证码有效期（分钟）</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
