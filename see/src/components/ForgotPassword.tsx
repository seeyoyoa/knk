import { useState, useRef, useEffect } from 'react';
import { useApp } from '../store';

type ForgotStep = 'email' | 'verify' | 'reset' | 'success';

export default function ForgotPassword({ onClose }: { onClose: () => void }) {
  const { sendVerificationCode, verifyCode, resetUserPassword, users, emailConfig } = useApp();
  const [step, setStep] = useState<ForgotStep>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [countdown, setCountdown] = useState(0);
  const [message, setMessage] = useState('');
  const [msgType, setMsgType] = useState<'success' | 'error'>('success');
  const [isLoading, setIsLoading] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const codeInputRef = useRef<HTMLInputElement>(null);

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
    if (step === 'verify' && codeInputRef.current) {
      setTimeout(() => codeInputRef.current?.focus(), 300);
    }
  }, [step]);

  useEffect(() => {
    const pwd = newPassword;
    let strength = 0;
    if (pwd.length >= 6) strength++;
    if (pwd.length >= 10) strength++;
    if (/[A-Z]/.test(pwd)) strength++;
    if (/[0-9]/.test(pwd)) strength++;
    if (/[^A-Za-z0-9]/.test(pwd)) strength++;
    setPasswordStrength(strength);
  }, [newPassword]);

  const handleSendCode = async () => {
    setMessage('');
    setMsgType('success');
    if (!email.trim()) { setMessage('请输入邮箱地址'); setMsgType('error'); return; }
    
    const user = users.find(u => u.email === email);
    if (!user) { setMessage('该邮箱未注册'); setMsgType('error'); return; }
    
    setIsLoading(true);
    try {
      const result = await sendVerificationCode(email, 'reset_password');
      setMessage(result.message);
      setMsgType(result.success ? 'success' : 'error');
      if (result.success) {
        setCountdown(60);
        setTimeout(() => setStep('verify'), 500);
      }
    } catch {
      setMessage('发送验证码失败，请重试');
      setMsgType('error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyCode = async () => {
    setMessage('');
    setMsgType('success');
    if (!code.trim()) { setMessage('请输入验证码'); setMsgType('error'); return; }
    
    setIsLoading(true);
    try {
      const result = verifyCode(email, code);
      setMessage(result.message);
      setMsgType(result.success ? 'success' : 'error');
      if (result.success) {
        setStep('reset');
      }
    } catch {
      setMessage('验证失败，请重试');
      setMsgType('error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPassword = () => {
    setMessage('');
    setMsgType('success');
    if (!newPassword || newPassword.length < 6) { setMessage('密码至少需要6个字符'); setMsgType('error'); return; }
    if (newPassword !== confirmPassword) { setMessage('两次输入的密码不一致'); setMsgType('error'); return; }
    
    setIsLoading(true);
    try {
      const result = resetUserPassword(email, code, newPassword);
      setMessage(result.message);
      setMsgType(result.success ? 'success' : 'error');
      if (result.success) {
        setTimeout(() => setStep('success'), 1000);
      }
    } catch {
      setMessage('密码重置失败，请重试');
      setMsgType('error');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-xl font-semibold text-[var(--ios-label)]">忘记密码</h3>
        <button onClick={onClose} className="text-[var(--ios-secondary-label)] hover:text-[var(--ios-label)] text-2xl leading-none">
          ×
        </button>
      </div>

      {/* Step Indicator */}
      <div className="flex items-center justify-center mb-6">
        <div className="flex items-center space-x-2">
          {['邮箱', '验证', '重置', '完成'].map((label, i) => (
            <div key={label} className="flex items-center">
              <div className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold ${
                (step === 'email' && i === 0) || (step === 'verify' && i <= 1) || (step === 'reset' && i <= 2) || (step === 'success' && i <= 3)
                  ? 'bg-[var(--ios-blue)] text-white'
                  : 'bg-[var(--ios-fill)] text-[var(--ios-secondary-label)]'
              }`}>
                {i + 1}
              </div>
              {i < 3 && (
                <div className={`w-6 h-0.5 mx-1 ${
                  (step === 'verify' && i >= 0) || (step === 'reset' && i >= 1) || (step === 'success' && i >= 2)
                    ? 'bg-[var(--ios-blue)]'
                    : 'bg-[var(--ios-fill)]'
                }`} />
              )}
            </div>
          ))}
        </div>
      </div>

      {message && (
        <div className={`mb-4 p-3 rounded-xl text-sm text-center ${
          msgType === 'success' ? 'bg-[var(--ios-green)]/10 text-[var(--ios-green)]' : 'bg-[var(--ios-red)]/10 text-[var(--ios-red)]'
        }`}>
          {message}
        </div>
      )}

      {/* Step 1: Enter Email */}
      {step === 'email' && (
        <div className="space-y-4">
          <p className="text-sm text-[var(--ios-secondary-label)] text-center">
            请输入您注册时使用的邮箱地址，我们将发送验证码
          </p>
          <input
            type="email"
            placeholder="邮箱地址"
            value={email}
            onChange={e => setEmail(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSendCode()}
            className="ios-input"
          />
          <button
            onClick={handleSendCode}
            disabled={isLoading}
            className="ios-btn w-full disabled:opacity-50"
          >
            {isLoading ? '发送中...' : '发送验证码'}
          </button>
          <div className="text-center">
            <button onClick={onClose} className="text-sm text-[var(--ios-blue)] font-medium">
              返回登录
            </button>
          </div>
        </div>
      )}

      {/* Step 2: Verify Code */}
      {step === 'verify' && (
        <div className="space-y-4">
          <div className="text-center">
            <p className="text-sm text-[var(--ios-secondary-label)]">
              验证码已发送至 <span className="text-[var(--ios-label)] font-medium">{email}</span>
            </p>
          </div>
          
          {!emailConfig.isEnabled && (
            <div className="p-3 rounded-xl bg-[var(--ios-teal)]/10">
              <p className="text-sm text-[var(--ios-teal)]">🔧 开发模式：邮件服务未启用，输入任意6位数字即可</p>
            </div>
          )}

          <input
            ref={codeInputRef}
            type="text"
            placeholder="输入6位验证码"
            value={code}
            onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            onKeyDown={e => e.key === 'Enter' && handleVerifyCode()}
            maxLength={6}
            className="ios-input text-center text-2xl tracking-widest font-mono"
          />
          
          <div className="flex items-center justify-between">
            <button
              onClick={handleSendCode}
              disabled={countdown > 0 || isLoading}
              className={`text-sm font-medium ${countdown > 0 ? 'text-[var(--ios-tertiary-label)]' : 'text-[var(--ios-blue)]'}`}
            >
              {countdown > 0 ? `${countdown}s 后重发` : isLoading ? '发送中...' : '重新发送'}
            </button>
            <button
              onClick={() => setStep('email')}
              className="text-sm text-[var(--ios-secondary-label)]"
            >
              修改邮箱
            </button>
          </div>

          <button
            onClick={handleVerifyCode}
            disabled={isLoading || code.length !== 6}
            className="ios-btn w-full disabled:opacity-50"
          >
            {isLoading ? '验证中...' : '验证'}
          </button>
        </div>
      )}

      {/* Step 3: Reset Password */}
      {step === 'reset' && (
        <div className="space-y-4">
          <p className="text-sm text-[var(--ios-secondary-label)] text-center">
            请设置您的新密码
          </p>
          
          <div>
            <input
              type="password"
              placeholder="新密码（至少6位）"
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
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
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleResetPassword()}
              className="ios-input"
            />
            {confirmPassword && newPassword !== confirmPassword && (
              <p className="mt-1 text-xs text-[var(--ios-red)]">两次输入的密码不一致</p>
            )}
          </div>

          <button
            onClick={handleResetPassword}
            disabled={isLoading}
            className="ios-btn w-full disabled:opacity-50"
          >
            {isLoading ? '重置中...' : '重置密码'}
          </button>
          
          <div className="text-center">
            <button onClick={() => setStep('verify')} className="text-sm text-[var(--ios-secondary-label)]">
              返回上一步
            </button>
          </div>
        </div>
      )}

      {/* Step 4: Success */}
      {step === 'success' && (
        <div className="text-center space-y-4">
          <div className="text-5xl">✅</div>
          <h4 className="text-lg font-semibold text-[var(--ios-label)]">密码重置成功</h4>
          <p className="text-sm text-[var(--ios-secondary-label)]">
            请使用新密码登录
          </p>
          <button onClick={onClose} className="ios-btn w-full">
            返回登录
          </button>
        </div>
      )}
    </div>
  );
}
