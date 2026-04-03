import { useState, useEffect, useCallback } from 'react';
import { useApp } from '../store';

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  plan: {
    id: string;
    name: string;
    price: number;
    duration: number;
  };
  onSuccess: () => void;
}

const API_BASE = '/api';

export default function PaymentModal({ isOpen, onClose, plan, onSuccess }: PaymentModalProps) {
  const { currentUser } = useApp();
  const [step, setStep] = useState<'select' | 'processing' | 'qrcode' | 'success' | 'error'>('select');
  const [paymentMethod, setPaymentMethod] = useState<'alipay' | 'usdt'>('alipay');
  const [paymentConfig, setPaymentConfig] = useState<any>(null);
  const [_orderData, setOrderData] = useState<any>(null);
  const [paymentData, setPaymentData] = useState<any>(null);
  const [error, setError] = useState('');
  const [countdown, setCountdown] = useState(900);
  const [pollingTimer, setPollingTimer] = useState<NodeJS.Timeout | null>(null);
  const [usdtRate, setUsdtRate] = useState(7.2);
  const [txHash, setTxHash] = useState('');

  // 获取支付配置
  useEffect(() => {
    if (isOpen) {
      fetchPaymentConfig();
    }
  }, [isOpen]);

  const fetchPaymentConfig = async () => {
    try {
      const res = await fetch(`${API_BASE}/payment/config`);
      const data = await res.json();
      if (data.success) {
        setPaymentConfig(data.data);
      }
    } catch (err) {
      console.error('获取支付配置失败:', err);
    }
  };

  // 获取USDT汇率
  useEffect(() => {
    if (paymentMethod === 'usdt') {
      fetchUSDTExchangeRate();
    }
  }, [paymentMethod]);

  const fetchUSDTExchangeRate = async () => {
    try {
      const res = await fetch(`${API_BASE}/payment/usdt/rate`);
      const data = await res.json();
      if (data.success) {
        setUsdtRate(data.rate);
      }
    } catch (err) {
      console.error('获取USDT汇率失败:', err);
    }
  };

  // 倒计时
  useEffect(() => {
    if (step === 'qrcode' && countdown > 0) {
      const timer = setInterval(() => {
        setCountdown(prev => {
          if (prev <= 1) {
            clearInterval(timer);
            stopPolling();
            setStep('error');
            setError('支付超时，请重新下单');
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [step, countdown]);

  const stopPolling = useCallback(() => {
    if (pollingTimer) {
      clearInterval(pollingTimer);
      setPollingTimer(null);
    }
  }, [pollingTimer]);

  // 轮询支付状态
  const startPolling = useCallback((orderId: string) => {
    stopPolling();
    const timer = setInterval(async () => {
      try {
        const res = await fetch(`${API_BASE}/payment/check/${orderId}`);
        const data = await res.json();
        if (data.success && data.data.status === 'paid') {
          stopPolling();
          setStep('success');
          setTimeout(() => {
            onSuccess();
            handleClose();
          }, 2000);
        }
      } catch (err) {
        console.error('轮询支付状态失败:', err);
      }
    }, 3000);
    setPollingTimer(timer as any);
  }, [stopPolling, onSuccess]);

  // 创建订单
  const createOrder = async () => {
    if (!currentUser) {
      setError('请先登录');
      return;
    }

    setStep('processing');
    setError('');

    try {
      // 1. 创建订单
      const orderRes = await fetch(`${API_BASE}/user/order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: currentUser.id,
          planId: plan.id
        })
      });

      const orderResult = await orderRes.json();
      if (!orderResult.success) {
        throw new Error(orderResult.message || '创建订单失败');
      }

      setOrderData(orderResult.data);
      const orderId = orderResult.data.orderId;

      // 2. 根据支付方式调用对应接口
      if (paymentMethod === 'alipay') {
        const payRes = await fetch(`${API_BASE}/payment/alipay/create`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            orderId,
            userId: currentUser.id,
            amount: plan.price,
            subject: plan.name
          })
        });

        const payResult = await payRes.json();
        if (payResult.success) {
          setPaymentData(payResult);
          setStep('qrcode');
          setCountdown(900); // 15分钟
          startPolling(orderId);
        } else {
          throw new Error(payResult.error || payResult.message || '创建支付宝订单失败');
        }
      } else if (paymentMethod === 'usdt') {
        const usdtAmount = (plan.price / usdtRate).toFixed(2);
        const payRes = await fetch(`${API_BASE}/payment/usdt/create`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            orderId,
            userId: currentUser.id,
            amountUSD: parseFloat(usdtAmount)
          })
        });

        const payResult = await payRes.json();
        if (payResult.success) {
          setPaymentData(payResult);
          setStep('qrcode');
          setCountdown(1800); // 30分钟
          startPolling(orderId);
        } else {
          throw new Error(payResult.error || payResult.message || '创建USDT订单失败');
        }
      }
    } catch (err: any) {
      setError(err.message);
      setStep('error');
    }
  };

  // 手动确认USDT支付
  const confirmUSDT = async () => {
    if (!txHash || !paymentData) return;

    try {
      const res = await fetch(`${API_BASE}/payment/usdt/callback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          txHash,
          network: paymentData.network,
          amount: paymentData.amount,
          to: paymentData.address,
          timestamp: Math.floor(Date.now() / 1000)
        })
      });

      const data = await res.json();
      if (data.success) {
        setStep('success');
        setTimeout(() => {
          onSuccess();
          handleClose();
        }, 2000);
      } else {
        setError(data.message || '确认失败，请检查交易哈希');
      }
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleClose = () => {
    stopPolling();
    setStep('select');
    setPaymentData(null);
    setOrderData(null);
    setError('');
    setTxHash('');
    onClose();
  };

  // 格式化倒计时
  const formatCountdown = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // 生成二维码SVG
  const renderQRCode = (data: string) => {
    return (
      <div className="bg-white p-4 rounded-xl inline-block">
        <div className="w-48 h-48 bg-gray-100 rounded-lg flex items-center justify-center text-gray-400 text-xs text-center p-2">
          <div>
            <svg className="w-16 h-16 mx-auto mb-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <rect x="2" y="2" width="8" height="8" rx="1" />
              <rect x="14" y="2" width="8" height="8" rx="1" />
              <rect x="2" y="14" width="8" height="8" rx="1" />
              <rect x="14" y="14" width="8" height="8" rx="1" />
              <rect x="4" y="4" width="4" height="4" fill="currentColor" />
              <rect x="16" y="4" width="4" height="4" fill="currentColor" />
              <rect x="4" y="16" width="4" height="4" fill="currentColor" />
              <rect x="16" y="16" width="4" height="4" fill="currentColor" />
            </svg>
            <p className="text-xs text-gray-500 break-all">{data.substring(0, 30)}...</p>
          </div>
        </div>
      </div>
    );
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={handleClose}>
      <div
        className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-700">
          <h2 className="text-xl font-bold text-white">
            {step === 'select' && '选择支付方式'}
            {step === 'processing' && '处理中...'}
            {step === 'qrcode' && '扫码支付'}
            {step === 'success' && '支付成功'}
            {step === 'error' && '支付失败'}
          </h2>
          <button onClick={handleClose} className="text-gray-400 hover:text-white transition-colors">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6">
          {/* 选择支付方式 */}
          {step === 'select' && (
            <div className="space-y-4">
              <div className="bg-gray-800 rounded-xl p-4 mb-4">
                <div className="flex justify-between items-center">
                  <span className="text-gray-400">套餐</span>
                  <span className="text-white font-medium">{plan.name}</span>
                </div>
                <div className="flex justify-between items-center mt-2">
                  <span className="text-gray-400">金额</span>
                  <span className="text-2xl font-bold text-emerald-400">¥{plan.price.toFixed(2)}</span>
                </div>
              </div>

              {/* 支付宝 */}
              {paymentConfig?.alipay?.enabled && (
                <button
                  onClick={() => setPaymentMethod('alipay')}
                  className={`w-full flex items-center gap-4 p-4 rounded-xl border-2 transition-all ${
                    paymentMethod === 'alipay'
                      ? 'border-blue-500 bg-blue-500/10'
                      : 'border-gray-700 hover:border-gray-600 bg-gray-800'
                  }`}
                >
                  <div className="w-12 h-12 bg-blue-500 rounded-xl flex items-center justify-center">
                    <span className="text-white font-bold text-lg">支</span>
                  </div>
                  <div className="flex-1 text-left">
                    <div className="text-white font-medium">支付宝</div>
                    <div className="text-gray-400 text-sm">当面付 - 扫码即时到账</div>
                  </div>
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                    paymentMethod === 'alipay' ? 'border-blue-500 bg-blue-500' : 'border-gray-600'
                  }`}>
                    {paymentMethod === 'alipay' && (
                      <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    )}
                  </div>
                </button>
              )}

              {/* USDT */}
              {paymentConfig?.usdt?.enabled && (
                <button
                  onClick={() => setPaymentMethod('usdt')}
                  className={`w-full flex items-center gap-4 p-4 rounded-xl border-2 transition-all ${
                    paymentMethod === 'usdt'
                      ? 'border-emerald-500 bg-emerald-500/10'
                      : 'border-gray-700 hover:border-gray-600 bg-gray-800'
                  }`}
                >
                  <div className="w-12 h-12 bg-emerald-500 rounded-xl flex items-center justify-center">
                    <span className="text-white font-bold text-lg">₮</span>
                  </div>
                  <div className="flex-1 text-left">
                    <div className="text-white font-medium">USDT ({paymentConfig.usdt.network})</div>
                    <div className="text-gray-400 text-sm">
                      ≈ ${(plan.price / usdtRate).toFixed(2)} USDT · 汇率 1 USDT = ¥{usdtRate.toFixed(2)}
                    </div>
                  </div>
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                    paymentMethod === 'usdt' ? 'border-emerald-500 bg-emerald-500' : 'border-gray-600'
                  }`}>
                    {paymentMethod === 'usdt' && (
                      <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    )}
                  </div>
                </button>
              )}

              {!paymentConfig?.alipay?.enabled && !paymentConfig?.usdt?.enabled && (
                <div className="text-center py-8 text-gray-400">
                  <p>暂无可用的支付方式</p>
                  <p className="text-sm mt-1">请联系管理员配置支付接口</p>
                </div>
              )}

              <button
                onClick={createOrder}
                disabled={!paymentConfig?.alipay?.enabled && !paymentConfig?.usdt?.enabled}
                className="w-full py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl font-medium hover:from-blue-500 hover:to-purple-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                确认支付 ¥{plan.price.toFixed(2)}
              </button>
            </div>
          )}

          {/* 处理中 */}
          {step === 'processing' && (
            <div className="text-center py-12">
              <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
              <p className="text-white text-lg">正在创建支付订单...</p>
              <p className="text-gray-400 mt-2">请稍候</p>
            </div>
          )}

          {/* 二维码支付 */}
          {step === 'qrcode' && paymentData && (
            <div className="space-y-6">
              {/* 倒计时 */}
              <div className="text-center">
                <div className="inline-flex items-center gap-2 bg-gray-800 px-4 py-2 rounded-full">
                  <svg className="w-4 h-4 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                  </svg>
                  <span className="text-yellow-400 font-mono font-bold">{formatCountdown(countdown)}</span>
                  <span className="text-gray-400 text-sm">后超时</span>
                </div>
              </div>

              {paymentMethod === 'alipay' ? (
                /* 支付宝支付 */
                <div className="text-center space-y-4">
                  <div className="flex items-center justify-center gap-2 mb-4">
                    <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center">
                      <span className="text-white font-bold">支</span>
                    </div>
                    <span className="text-white font-medium">支付宝当面付</span>
                  </div>

                  {renderQRCode(paymentData.qrCode)}

                  <p className="text-gray-400 text-sm">
                    请使用支付宝扫描二维码完成支付
                  </p>

                  <div className="bg-gray-800 rounded-xl p-4 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-400">订单号</span>
                      <span className="text-gray-300 font-mono text-xs">{paymentData.outTradeNo}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-400">支付金额</span>
                      <span className="text-emerald-400 font-bold">¥{plan.price.toFixed(2)}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                    <span>系统自动检测支付结果，支付成功后自动开通</span>
                  </div>
                </div>
              ) : (
                /* USDT支付 */
                <div className="text-center space-y-4">
                  <div className="flex items-center justify-center gap-2 mb-4">
                    <div className="w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center">
                      <span className="text-white font-bold">₮</span>
                    </div>
                    <span className="text-white font-medium">USDT ({paymentData.network})</span>
                  </div>

                  <div className="bg-gray-800 rounded-xl p-4">
                    <div className="text-sm text-gray-400 mb-1">收款金额</div>
                    <div className="text-3xl font-bold text-emerald-400">{paymentData.amount} USDT</div>
                    <div className="text-sm text-gray-500 mt-1">≈ ¥{plan.price.toFixed(2)}</div>
                  </div>

                  <div className="bg-gray-800 rounded-xl p-4">
                    <div className="text-sm text-gray-400 mb-2">收款地址</div>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 text-xs text-white bg-gray-900 p-2 rounded break-all">
                        {paymentData.address}
                      </code>
                      <button
                        onClick={() => navigator.clipboard.writeText(paymentData.address)}
                        className="px-3 py-2 bg-emerald-600 text-white rounded-lg text-sm hover:bg-emerald-500 transition-colors shrink-0"
                      >
                        复制
                      </button>
                    </div>
                  </div>

                  <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-3">
                    <p className="text-yellow-400 text-sm">
                      ⚠️ 请确保使用 {paymentData.network} 网络发送 USDT，否则可能导致资产丢失
                    </p>
                  </div>

                  {/* 手动确认 */}
                  <div className="bg-gray-800 rounded-xl p-4">
                    <div className="text-sm text-gray-400 mb-2">或手动输入交易哈希确认</div>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={txHash}
                        onChange={e => setTxHash(e.target.value)}
                        placeholder="输入交易哈希 (TxHash)"
                        className="flex-1 bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500"
                      />
                      <button
                        onClick={confirmUSDT}
                        disabled={!txHash}
                        className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm hover:bg-emerald-500 transition-colors disabled:opacity-50"
                      >
                        确认
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                    <span>链上确认后自动开通套餐</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 支付成功 */}
          {step === 'success' && (
            <div className="text-center py-8">
              <div className="w-20 h-20 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-10 h-10 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h3 className="text-2xl font-bold text-white mb-2">支付成功！</h3>
              <p className="text-gray-400">套餐已自动开通，正在跳转到用户面板...</p>
            </div>
          )}

          {/* 支付失败 */}
          {step === 'error' && (
            <div className="text-center py-8 space-y-4">
              <div className="w-20 h-20 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-10 h-10 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-white">支付失败</h3>
              <p className="text-gray-400">{error || '未知错误'}</p>
              <div className="flex gap-3 justify-center mt-4">
                <button
                  onClick={() => setStep('select')}
                  className="px-6 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors"
                >
                  重新选择
                </button>
                <button
                  onClick={createOrder}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-500 transition-colors"
                >
                  重新支付
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
