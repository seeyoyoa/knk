import { useState } from 'react';
import { useApp } from '../store';

export default function AdminLogin() {
  const { adminLogin, setCurrentView } = useApp();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    await new Promise(resolve => setTimeout(resolve, 800));
    const success = adminLogin(username, password);
    if (success) {
      setCurrentView('admin');
    } else {
      setError('用户名或密码错误');
    }
    setIsLoading(false);
  };

  return (
    <div className="min-h-screen bg-[var(--ios-bg)] flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-[var(--ios-blue)] mb-4">
            <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h1 className="ios-subtitle text-[var(--ios-label)]">管理后台</h1>
          <p className="text-[var(--ios-secondary-label)] mt-1">请输入管理员账号和密码</p>
        </div>

        {/* Login Form */}
        <div className="ios-card p-6">
          {error && (
            <div className="mb-4 p-3 rounded-xl bg-[var(--ios-red)]/10 text-[var(--ios-red)] text-sm text-center">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="space-y-3 mb-5">
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="ios-input"
                placeholder="管理员账号"
                autoComplete="username"
              />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="ios-input"
                placeholder="密码"
                autoComplete="current-password"
              />
            </div>

            <button type="submit" disabled={isLoading} className="ios-btn w-full">
              {isLoading ? '登录中...' : '登录'}
            </button>
          </form>
        </div>

        <div className="mt-6 text-center">
          <button
            onClick={() => setCurrentView('shop')}
            className="text-sm text-[var(--ios-blue)] font-medium"
          >
            ← 返回商城
          </button>
        </div>

        <p className="text-center text-xs text-[var(--ios-tertiary-label)] mt-8">
          默认账号: admin / admin123
        </p>
      </div>
    </div>
  );
}
