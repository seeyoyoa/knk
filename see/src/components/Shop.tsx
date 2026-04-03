import { useState, useEffect, useRef, useCallback } from 'react';
import { useApp } from '../store';
import PaymentModal from './PaymentModal';
import ForgotPassword from './ForgotPassword';

export default function Shop() {
  const { plans, setCurrentView, setCurrentUser, userLogin, userRegister, paymentConfig, currentUser: ctxCurrentUser, sendVerificationCode, verifyCode, emailConfig } = useApp();
  const [showLogin, setShowLogin] = useState(false);
  const [showRegister, setShowRegister] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [loginData, setLoginData] = useState({ username: '', password: '' });
  const [registerData, setRegisterData] = useState({ username: '', email: '', password: '', confirmPassword: '', verificationCode: '', inviteCode: '' });
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [showPayment, setShowPayment] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [registerError, setRegisterError] = useState('');
  const [registerStep, setRegisterStep] = useState<'info' | 'verify' | 'success'>('info');
  const [countdown, setCountdown] = useState(0);
  const [codeMessage, setCodeMessage] = useState('');
  const [codeType, setCodeType] = useState<'success' | 'error'>('success');
  const [isSendingCode, setIsSendingCode] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [emailError, setEmailError] = useState('');
  const [passwordStrength, setPasswordStrength] = useState(0);
  const [registerSuccessData, setRegisterSuccessData] = useState<{ username: string; email: string; inviteResult?: { success: boolean; message: string } } | null>(null);

  // Parse invite code from URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const invite = params.get('invite');
    if (invite) {
      setRegisterData(prev => ({ ...prev, inviteCode: invite.toUpperCase() }));
    }
  }, []);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const codeInputRef = useRef<HTMLInputElement>(null);

  const resetRegister = () => {
    setRegisterStep('info');
    setRegisterError('');
    setCodeMessage('');
    setCodeType('success');
    setCountdown(0);
    setRegisterData({ username: '', email: '', password: '', confirmPassword: '', verificationCode: '', inviteCode: '' });
    setEmailError('');
    setPasswordStrength(0);
    setRegisterSuccessData(null);
  };

  useEffect(() => {
    if (countdown > 0) {
      timerRef.current = setInterval(() => {
        setCountdown(prev => {
          if (prev <= 1) {
            clearInterval(timerRef.current!);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [countdown]);

  useEffect(() => {
    if (registerStep === 'verify' && codeInputRef.current) {
      setTimeout(() => codeInputRef.current?.focus(), 300);
    }
  }, [registerStep]);

  useEffect(() => {
    const pwd = registerData.password;
    let strength = 0;
    if (pwd.length >= 6) strength++;
    if (pwd.length >= 10) strength++;
    if (/[A-Z]/.test(pwd)) strength++;
    if (/[0-9]/.test(pwd)) strength++;
    if (/[^A-Za-z0-9]/.test(pwd)) strength++;
    setPasswordStrength(strength);
  }, [registerData.password]);

  const validateEmail = useCallback((email: string): boolean => {
    if (!email) { setEmailError(''); return true; }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) { setEmailError('请输入有效的邮箱地址'); return false; }
    setEmailError('');
    return true;
  }, []);



  const handleLogin = () => {
    setLoginError('');
    if (!loginData.username.trim()) { setLoginError('请输入用户名'); return; }
    if (!loginData.password.trim()) { setLoginError('请输入密码'); return; }
    const user = userLogin(loginData.username, loginData.password);
    if (user) {
      setCurrentUser(user);
      setShowLogin(false);
      setLoginData({ username: '', password: '' });
      setCurrentView('userpanel');
    } else {
      setLoginError('用户名或密码错误');
    }
  };

  const handleSendCode = async () => {
    setCodeMessage('');
    setCodeType('success');
    if (!registerData.email.trim()) { setCodeMessage('请输入邮箱地址'); setCodeType('error'); return; }
    if (!validateEmail(registerData.email)) { setCodeMessage('请输入有效的邮箱地址'); setCodeType('error'); return; }
    setIsSendingCode(true);
    try {
      const result = await sendVerificationCode(registerData.email, 'register');
      setCodeMessage(result.message);
      setCodeType(result.success ? 'success' : 'error');
      if (result.success) {
        setCountdown(60);
      }
    } catch {
      setCodeMessage('发送验证码失败，请重试');
      setCodeType('error');
    } finally {
      setIsSendingCode(false);
    }
  };

  const handleVerifyCode = async () => {
    setCodeMessage('');
    setCodeType('success');
    setRegisterError('');
    if (!registerData.verificationCode.trim()) { setCodeMessage('请输入验证码'); setCodeType('error'); return; }
    setIsVerifying(true);
    try {
      const result = verifyCode(registerData.email, registerData.verificationCode);
      setCodeMessage(result.message);
      setCodeType(result.success ? 'success' : 'error');
      if (result.success) {
        const { user, inviteResult } = userRegister(registerData.username, registerData.email, registerData.password, registerData.inviteCode || undefined);
        if (user) {
          setRegisterSuccessData({ username: registerData.username, email: registerData.email, inviteResult });
          setRegisterStep('success');
          setCurrentUser(user);
        } else {
          setRegisterError('用户名或邮箱已存在');
        }
      } else if (result.message.includes('上限')) {
        setCountdown(0);
        setRegisterData(prev => ({ ...prev, verificationCode: '' }));
      }
    } catch {
      setCodeMessage('验证失败，请重试');
      setCodeType('error');
    } finally {
      setIsVerifying(false);
    }
  };

  const handleRegisterNext = async () => {
    setRegisterError('');
    setCodeMessage('');
    if (!registerData.username.trim()) { setRegisterError('请输入用户名'); return; }
    if (registerData.username.length < 2) { setRegisterError('用户名至少需要2个字符'); return; }
    if (!registerData.email.trim()) { setRegisterError('请输入邮箱地址'); return; }
    if (!validateEmail(registerData.email)) { setRegisterError('请输入有效的邮箱地址'); return; }
    if (!registerData.password.trim() || registerData.password.length < 6) { setRegisterError('密码至少需要6个字符'); return; }
    if (registerData.password !== registerData.confirmPassword) { setRegisterError('两次输入的密码不一致'); return; }
    if (!emailConfig.isEnabled) {
      const result = userRegister(registerData.username, registerData.email, registerData.password);
      if (result.user) {
        setRegisterSuccessData({ username: registerData.username, email: registerData.email, inviteResult: result.inviteResult });
        setRegisterStep('success');
        setCurrentUser(result.user);
      } else {
        setRegisterError('用户名或邮箱已存在');
      }
      return;
    }
    setRegisterStep('verify');
    setCountdown(0);
    setCodeMessage('');
    setIsSendingCode(true);
    try {
      const result = await sendVerificationCode(registerData.email, 'register');
      setCodeMessage(result.message);
      setCodeType(result.success ? 'success' : 'error');
      if (result.success) {
        setCountdown(60);
      }
    } catch {
      setCodeMessage('发送验证码失败，请重试');
      setCodeType('error');
    } finally {
      setIsSendingCode(false);
    }
  };

  const handlePurchase = (planId: string) => {
    if (!ctxCurrentUser) { setShowLogin(true); return; }
    setSelectedPlan(planId);
    setShowPayment(true);
  };

  const selectedPlanData = selectedPlan ? plans.find(p => p.id === selectedPlan) : null;

  return (
    <div className="min-h-screen bg-[var(--ios-bg)]">
      {/* iOS-style Navigation Bar */}
      <nav className="ios-navbar">
        <div className="mx-auto max-w-5xl px-4 py-3 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--ios-blue)]">
              <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <span className="text-lg font-semibold text-[var(--ios-label)]">RocketStore</span>
          </div>
          <div className="flex items-center space-x-2">
            {ctxCurrentUser ? (
              <button onClick={() => setCurrentView('userpanel')} className="text-sm font-medium text-[var(--ios-blue)] hover:opacity-70 transition-opacity">
                控制面板
              </button>
            ) : (
              <>
                <button onClick={() => setShowLogin(true)} className="text-sm font-medium text-[var(--ios-blue)] hover:opacity-70 transition-opacity">
                  登录
                </button>
                <button onClick={() => setShowRegister(true)} className="ios-btn text-sm py-2 px-4">
                  注册
                </button>
              </>
            )}
            <button onClick={() => setCurrentView('admin')} className="text-sm font-medium text-[var(--ios-secondary-label)] hover:text-[var(--ios-label)] transition-colors">
              管理
            </button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-12 pb-8 px-4">
        <div className="mx-auto max-w-5xl">
          <div className="ios-card p-8 text-center">
            <div className="text-5xl mb-4">🚀</div>
            <h1 className="ios-large-title text-[var(--ios-label)] mb-3">
              高速稳定节点
            </h1>
            <p className="text-[var(--ios-secondary-label)] text-lg mb-6 max-w-xl mx-auto">
              畅享全球高速线路，支持所有主流客户端，稳定快速，安全可靠
            </p>
            <div className="flex justify-center space-x-3">
              <a href="#plans" className="ios-btn">查看套餐</a>
              <a href="#features" className="ios-btn ios-btn-secondary">了解更多</a>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="px-4 pb-8">
        <div className="mx-auto max-w-5xl">
          <h2 className="ios-subtitle text-[var(--ios-label)] mb-4 px-1">特色功能</h2>
          <div className="grid gap-3 md:grid-cols-3">
            {[
              { icon: '⚡', title: '高速线路', desc: 'IPLC/IEPL专线，低延迟高速', color: 'var(--ios-orange)' },
              { icon: '🌍', title: '全球节点', desc: '覆盖全球主要国家/地区', color: 'var(--ios-blue)' },
              { icon: '📱', title: '全平台支持', desc: '支持所有主流客户端', color: 'var(--ios-purple)' },
            ].map((feature, index) => (
              <div key={index} className="ios-card p-5">
                <div className="flex items-center space-x-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl text-2xl" style={{ backgroundColor: `${feature.color}15` }}>
                    {feature.icon}
                  </div>
                  <div>
                    <h3 className="font-semibold text-[var(--ios-label)]">{feature.title}</h3>
                    <p className="text-sm text-[var(--ios-secondary-label)]">{feature.desc}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Payment Methods */}
      <section id="payment" className="px-4 pb-8">
        <div className="mx-auto max-w-5xl">
          <h2 className="ios-subtitle text-[var(--ios-label)] mb-4 px-1">支付方式</h2>
          <div className="ios-list">
            {paymentConfig.alipay.enabled && (
              <div className="ios-list-item">
                <div className="ios-list-item-icon bg-[var(--ios-blue)]/10">
                  <span className="text-xl">💰</span>
                </div>
                <div className="flex-1 ml-3">
                  <div className="font-medium text-[var(--ios-label)]">支付宝</div>
                  <div className="text-sm text-[var(--ios-secondary-label)]">当面付扫码支付，自动到账</div>
                </div>
                <span className="text-[var(--ios-green)] text-sm font-medium">✓ 已启用</span>
              </div>
            )}
            {paymentConfig.usdt.enabled && (
              <div className="ios-list-item">
                <div className="ios-list-item-icon bg-[var(--ios-green)]/10">
                  <span className="text-xl">🪙</span>
                </div>
                <div className="flex-1 ml-3">
                  <div className="font-medium text-[var(--ios-label)]">USDT</div>
                  <div className="text-sm text-[var(--ios-secondary-label)]">{paymentConfig.usdt.network} 网络</div>
                </div>
                <span className="text-[var(--ios-green)] text-sm font-medium">✓ 已启用</span>
              </div>
            )}
            {!paymentConfig.alipay.enabled && !paymentConfig.usdt.enabled && (
              <div className="p-6 text-center">
                <p className="text-[var(--ios-secondary-label)]">管理员尚未配置支付方式</p>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Plans */}
      <section id="plans" className="px-4 pb-24">
        <div className="mx-auto max-w-5xl">
          <h2 className="ios-subtitle text-[var(--ios-label)] mb-4 px-1">选择套餐</h2>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
            {plans.filter(p => p.isActive).map((plan) => (
              <div key={plan.id} className={`ios-card p-5 relative ${plan.isPopular ? 'ring-2 ring-[var(--ios-blue)]' : ''}`}>
                {plan.isPopular && (
                  <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 ios-badge bg-[var(--ios-blue)] text-white">
                    最受欢迎
                  </div>
                )}
                <h3 className="font-semibold text-[var(--ios-label)] mb-1">{plan.name}</h3>
                <div className="mb-4">
                  <span className="text-3xl font-bold text-[var(--ios-label)]">¥{plan.price}</span>
                  <span className="text-[var(--ios-secondary-label)]">/{plan.duration}天</span>
                </div>
                <ul className="mb-5 space-y-2 text-sm text-[var(--ios-secondary-label)]">
                  <li className="flex items-center space-x-2">
                    <span className="text-[var(--ios-green)]">✓</span>
                    <span>{plan.dataLimit}GB 流量/月</span>
                  </li>
                  {plan.speedLimit && (
                    <li className="flex items-center space-x-2">
                      <span className="text-[var(--ios-green)]">✓</span>
                      <span>限速 {plan.speedLimit}Mbps</span>
                    </li>
                  )}
                  <li className="flex items-center space-x-2">
                    <span className="text-[var(--ios-green)]">✓</span>
                    <span>{plan.nodeGroups.length} 个节点区域</span>
                  </li>
                  {plan.features.map((feature, i) => (
                    <li key={i} className="flex items-center space-x-2">
                      <span className="text-[var(--ios-green)]">✓</span>
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
                <button
                  onClick={() => handlePurchase(plan.id)}
                  className={`w-full py-2.5 rounded-xl text-center font-medium text-sm transition-all ${
                    plan.isPopular
                      ? 'bg-[var(--ios-blue)] text-white hover:opacity-85'
                      : 'bg-[var(--ios-fill)] text-[var(--ios-blue)] hover:bg-[var(--ios-blue)] hover:text-white'
                  }`}
                >
                  立即购买
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-[var(--ios-separator)] py-6 px-4">
        <div className="mx-auto max-w-5xl text-center text-[var(--ios-secondary-label)] text-sm">
          <p>© 2026 RocketStore. All rights reserved.</p>
        </div>
      </footer>

      {/* Login Modal - iOS Style */}
      {showLogin && (
        <div className="ios-modal-overlay" onClick={() => { setShowLogin(false); setLoginError(''); }}>
          <div className="ios-modal" onClick={e => e.stopPropagation()}>
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="ios-subtitle text-[var(--ios-label)]">登录账户</h3>
                <button onClick={() => { setShowLogin(false); setLoginError(''); }} className="text-[var(--ios-secondary-label)] hover:text-[var(--ios-label)] text-2xl leading-none">
                  ×
                </button>
              </div>

              {/* Debug Accounts */}
              <div className="mb-5 p-4 rounded-xl bg-[var(--ios-fill)]">
                <p className="text-sm font-semibold text-[var(--ios-blue)] mb-2">🔧 调试测试账号</p>
                <div className="space-y-1.5 text-sm">
                  <div className="flex justify-between items-center py-1.5 px-3 rounded-lg bg-[var(--ios-card)]">
                    <span className="text-[var(--ios-secondary-label)]">用户</span>
                    <span className="font-mono font-medium text-[var(--ios-label)]">testuser</span>
                  </div>
                  <div className="flex justify-between items-center py-1.5 px-3 rounded-lg bg-[var(--ios-card)]">
                    <span className="text-[var(--ios-secondary-label)]">密码</span>
                    <span className="font-mono font-medium text-[var(--ios-label)]">test123</span>
                  </div>
                </div>
              </div>

              {loginError && (
                <div className="mb-4 p-3 rounded-xl bg-[var(--ios-red)]/10 text-[var(--ios-red)] text-sm text-center">
                  {loginError}
                </div>
              )}

              <div className="space-y-3 mb-5">
                <input
                  type="text"
                  placeholder="用户名"
                  value={loginData.username}
                  onChange={e => setLoginData(prev => ({ ...prev, username: e.target.value }))}
                  onKeyDown={e => e.key === 'Enter' && handleLogin()}
                  className="ios-input"
                />
                <input
                  type="password"
                  placeholder="密码"
                  value={loginData.password}
                  onChange={e => setLoginData(prev => ({ ...prev, password: e.target.value }))}
                  onKeyDown={e => e.key === 'Enter' && handleLogin()}
                  className="ios-input"
                />
              </div>

              <button onClick={handleLogin} className="ios-btn w-full mb-3">
                登录
              </button>

              <div className="text-center mb-2">
                <button onClick={() => { setShowLogin(false); setShowForgotPassword(true); }} className="text-sm text-[var(--ios-secondary-label)] hover:text-[var(--ios-label)] transition-colors">
                  忘记密码？
                </button>
              </div>

              <div className="text-center">
                <button onClick={() => { setShowLogin(false); setShowRegister(true); setRegisterError(''); }} className="text-sm text-[var(--ios-blue)] font-medium">
                  还没有账户？注册
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Forgot Password Modal */}
      {showForgotPassword && (
        <div className="ios-modal-overlay" onClick={() => { setShowForgotPassword(false); }}>
          <div className="ios-modal" onClick={e => e.stopPropagation()}>
            <ForgotPassword onClose={() => { setShowForgotPassword(false); setShowLogin(true); }} />
          </div>
        </div>
      )}

      {/* Register Modal - iOS Style */}
      {showRegister && (
        <div className="ios-modal-overlay" onClick={() => { setShowRegister(false); resetRegister(); }}>
          <div className="ios-modal" onClick={e => e.stopPropagation()}>
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="ios-subtitle text-[var(--ios-label)]">注册账户</h3>
                <button onClick={() => { setShowRegister(false); resetRegister(); }} className="text-[var(--ios-secondary-label)] hover:text-[var(--ios-label)] text-2xl leading-none">
                  ×
                </button>
              </div>

              {/* Step Indicator */}
              <div className="flex items-center justify-center mb-6">
                <div className="flex items-center space-x-2">
                  <div className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold ${
                    registerStep === 'info' || registerStep === 'verify' || registerStep === 'success'
                      ? 'bg-[var(--ios-blue)] text-white'
                      : 'bg-[var(--ios-fill)] text-[var(--ios-secondary-label)]'
                  }`}>
                    1
                  </div>
                  <div className={`w-8 h-0.5 ${registerStep !== 'info' ? 'bg-[var(--ios-blue)]' : 'bg-[var(--ios-fill)]'}`} />
                  <div className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold ${
                    registerStep === 'verify' || registerStep === 'success'
                      ? 'bg-[var(--ios-blue)] text-white'
                      : 'bg-[var(--ios-fill)] text-[var(--ios-secondary-label)]'
                  }`}>
                    2
                  </div>
                  <div className={`w-8 h-0.5 ${registerStep === 'success' ? 'bg-[var(--ios-blue)]' : 'bg-[var(--ios-fill)]'}`} />
                  <div className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold ${
                    registerStep === 'success'
                      ? 'bg-[var(--ios-blue)] text-white'
                      : 'bg-[var(--ios-fill)] text-[var(--ios-secondary-label)]'
                  }`}>
                    ✓
                  </div>
                </div>
              </div>

              {registerStep === 'info' && (
                <>
                  {registerError && (
                    <div className="mb-4 p-3 rounded-xl bg-[var(--ios-red)]/10 text-[var(--ios-red)] text-sm text-center">
                      {registerError}
                    </div>
                  )}

                  <div className="space-y-3 mb-5">
                    <input
                      type="text"
                      placeholder="用户名"
                      value={registerData.username}
                      onChange={e => setRegisterData(prev => ({ ...prev, username: e.target.value }))}
                      className="ios-input"
                    />
                    <div>
                      <input
                        type="email"
                        placeholder="邮箱地址"
                        value={registerData.email}
                        onChange={e => {
                          setRegisterData(prev => ({ ...prev, email: e.target.value }));
                          validateEmail(e.target.value);
                        }}
                        className="ios-input"
                      />
                      {emailError && (
                        <p className="mt-1 text-xs text-[var(--ios-red)]">{emailError}</p>
                      )}
                    </div>
                    <div>
                      <input
                        type="password"
                        placeholder="密码（至少6位）"
                        value={registerData.password}
                        onChange={e => setRegisterData(prev => ({ ...prev, password: e.target.value }))}
                        className="ios-input"
                      />
                      {registerData.password && (
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
                        placeholder="确认密码"
                        value={registerData.confirmPassword}
                        onChange={e => setRegisterData(prev => ({ ...prev, confirmPassword: e.target.value }))}
                        className="ios-input"
                      />
                      {registerData.confirmPassword && registerData.password !== registerData.confirmPassword && (
                        <p className="mt-1 text-xs text-[var(--ios-red)]">两次输入的密码不一致</p>
                      )}
                    </div>
                  </div>

                  <button onClick={handleRegisterNext} className="ios-btn w-full">
                    下一步：验证邮箱 →
                  </button>
                </>
              )}

              {registerStep === 'verify' && (
                <>
                  {registerError && (
                    <div className="mb-4 p-3 rounded-xl bg-[var(--ios-red)]/10 text-[var(--ios-red)] text-sm text-center">
                      {registerError}
                    </div>
                  )}

                  <div className="text-center mb-5">
                    <p className="text-[var(--ios-secondary-label)] text-sm">
                      验证码已发送至 <span className="text-[var(--ios-label)] font-medium">{registerData.email}</span>
                    </p>
                  </div>



                  {codeMessage && (
                    <div className={`mb-4 p-3 rounded-xl text-sm text-center ${
                      codeType === 'success' ? 'bg-[var(--ios-green)]/10 text-[var(--ios-green)]' : 'bg-[var(--ios-red)]/10 text-[var(--ios-red)]'
                    }`}>
                      {codeMessage}
                    </div>
                  )}

                  <div className="space-y-3 mb-5">
                    <input
                      ref={codeInputRef}
                      type="text"
                      placeholder="输入6位验证码"
                      value={registerData.verificationCode}
                      onChange={e => setRegisterData(prev => ({ ...prev, verificationCode: e.target.value.replace(/\D/g, '').slice(0, 6) }))}
                      onKeyDown={e => e.key === 'Enter' && handleVerifyCode()}
                      maxLength={6}
                      className="ios-input text-center text-2xl tracking-widest font-mono"
                    />
                    <div className="flex items-center justify-between">
                      <button
                        onClick={handleSendCode}
                        disabled={countdown > 0 || isSendingCode}
                        className={`text-sm font-medium ${countdown > 0 ? 'text-[var(--ios-tertiary-label)]' : 'text-[var(--ios-blue)]'}`}
                      >
                        {countdown > 0 ? `${countdown}s 后重发` : isSendingCode ? '发送中...' : '重新发送'}
                      </button>
                      <button
                        onClick={() => setRegisterStep('info')}
                        className="text-sm text-[var(--ios-secondary-label)]"
                      >
                        返回修改
                      </button>
                    </div>
                  </div>

                  <button
                    onClick={handleVerifyCode}
                    disabled={isVerifying || registerData.verificationCode.length !== 6}
                    className="ios-btn w-full"
                  >
                    {isVerifying ? '验证中...' : '验证并注册'}
                  </button>
                </>
              )}

              {registerStep === 'success' && (
                <div className="text-center py-4">
                  <div className="text-5xl mb-4">🎉</div>
                  <h4 className="ios-subtitle text-[var(--ios-label)] mb-2">注册成功！</h4>
                  <p className="text-[var(--ios-secondary-label)] mb-6">
                    欢迎 <span className="text-[var(--ios-label)] font-medium">{registerSuccessData?.username}</span> 加入 RocketStore
                  </p>
                  <button
                    onClick={() => { setShowRegister(false); resetRegister(); setCurrentView('userpanel'); }}
                    className="ios-btn w-full"
                  >
                    进入控制面板
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Payment Modal */}
      {showPayment && selectedPlanData && (
        <PaymentModal
          isOpen={showPayment}
          plan={selectedPlanData}
          onClose={() => { setShowPayment(false); setSelectedPlan(null); }}
          onSuccess={() => { setShowPayment(false); setSelectedPlan(null); setCurrentView('userpanel'); }}
        />
      )}
    </div>
  );
}
