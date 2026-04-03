import { useState } from 'react';
import { useApp } from '../store';

export default function InvitePanel() {
  const { currentUser, inviteConfig, generateUserInviteCode, getUserInvitations, getUserVouchers } = useApp();
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<'invite' | 'vouchers' | 'history'>('invite');

  if (!currentUser) return null;

  const inviteCode = generateUserInviteCode(currentUser.id);
  const userInvitations = getUserInvitations(currentUser.id);
  const userVouchers = getUserVouchers(currentUser.id);
  const inviteLink = `${window.location.origin}/register?invite=${inviteCode}`;

  const totalRewards = userInvitations.reduce((sum, inv) => sum + (inv.rewardAmount || 0), 0);
  const successfulInvites = userInvitations.filter(inv => inv.status === 'rewarded').length;
  const pendingInvites = userInvitations.filter(inv => inv.status === 'pending' || inv.status === 'registered').length;
  const availableVouchers = userVouchers.filter(v => v.status === 'available');
  const totalVoucherValue = availableVouchers.reduce((sum, v) => sum + v.amount, 0);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const shareText = `${inviteConfig.shareTitle}\n${inviteConfig.shareDescription}\n\n使用我的邀请链接注册：${inviteLink}\n\n邀请码：${inviteCode}`;

  const statusMap: Record<string, { label: string; color: string; bg: string }> = {
    pending: { label: '待注册', color: '#6E6E73', bg: '#F2F2F7' },
    registered: { label: '已注册', color: '#007AFF', bg: '#E5F1FF' },
    purchased: { label: '已购买', color: '#FF9500', bg: '#FFF3E0' },
    rewarded: { label: '已奖励', color: '#34C759', bg: '#E8F5E9' },
    expired: { label: '已过期', color: '#FF3B30', bg: '#FFEBEE' },
  };

  return (
    <div style={{ padding: '0 16px 16px' }}>
      {/* 邀请统计卡片 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '20px' }}>
        {[
          { label: '邀请人数', value: userInvitations.length, icon: '👥', color: '#007AFF' },
          { label: '成功邀请', value: successfulInvites, icon: '✅', color: '#34C759' },
          { label: '累计奖励', value: `¥${totalRewards.toFixed(2)}`, icon: '💰', color: '#FF9500' },
          { label: '可用代金券', value: `¥${totalVoucherValue.toFixed(2)}`, icon: '🎫', color: '#AF52DE' },
        ].map((stat, i) => (
          <div key={i} style={{
            background: '#fff',
            borderRadius: '16px',
            padding: '16px',
            textAlign: 'center',
            boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
          }}>
            <div style={{ fontSize: '24px', marginBottom: '4px' }}>{stat.icon}</div>
            <div style={{ fontSize: '18px', fontWeight: '700', color: stat.color }}>{stat.value}</div>
            <div style={{ fontSize: '12px', color: '#6E6E73', marginTop: '2px' }}>{stat.label}</div>
          </div>
        ))}
      </div>

      {/* 邀请规则说明 */}
      {inviteConfig.enabled && (
        <div style={{
          background: 'linear-gradient(135deg, #007AFF 0%, #5856D6 100%)',
          borderRadius: '16px',
          padding: '20px',
          marginBottom: '20px',
          color: '#fff',
        }}>
          <h3 style={{ margin: '0 0 12px', fontSize: '18px', fontWeight: '600' }}>🎁 邀请奖励规则</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '13px', opacity: 0.9 }}>
            <div>奖励方式：{inviteConfig.rewardType === 'percentage' ? `消费金额的 ${inviteConfig.rewardAmount}%` : `固定 ¥${inviteConfig.rewardAmount}`}</div>
            <div>单次最高：¥{inviteConfig.maxRewardPerInvite}</div>
            <div>每日上限：¥{inviteConfig.maxRewardPerDay}</div>
            <div>最低消费：¥{inviteConfig.minPurchaseAmount}</div>
            <div>代金有效期：{inviteConfig.rewardExpiry}天</div>
            <div>待处理邀请：{pendingInvites}个</div>
          </div>
        </div>
      )}

      {/* Tab 切换 */}
      <div style={{ display: 'flex', gap: '4px', marginBottom: '16px', background: '#F2F2F7', borderRadius: '10px', padding: '3px' }}>
        {[
          { key: 'invite' as const, label: '邀请好友', icon: '🔗' },
          { key: 'vouchers' as const, label: '我的代金券', icon: '🎫' },
          { key: 'history' as const, label: '邀请记录', icon: '📋' },
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            style={{
              flex: 1,
              padding: '10px 8px',
              border: 'none',
              borderRadius: '8px',
              background: activeTab === tab.key ? '#fff' : 'transparent',
              color: activeTab === tab.key ? '#007AFF' : '#6E6E73',
              fontSize: '13px',
              fontWeight: activeTab === tab.key ? '600' : '400',
              cursor: 'pointer',
              boxShadow: activeTab === tab.key ? '0 2px 8px rgba(0,0,0,0.08)' : 'none',
              transition: 'all 0.2s',
            }}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {/* 邀请好友 Tab */}
      {activeTab === 'invite' && (
        <div>
          {/* 邀请码卡片 */}
          <div style={{
            background: '#fff',
            borderRadius: '16px',
            padding: '20px',
            marginBottom: '16px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
          }}>
            <div style={{ textAlign: 'center', marginBottom: '16px' }}>
              <div style={{ fontSize: '48px', marginBottom: '8px' }}>🎁</div>
              <h3 style={{ margin: '0 0 4px', fontSize: '16px', fontWeight: '600', color: '#1C1C1E' }}>
                {inviteConfig.inviteButtonText}
              </h3>
              <p style={{ margin: '0', fontSize: '13px', color: '#6E6E73' }}>
                好友通过你的链接注册并购买，双方都能获得奖励
              </p>
            </div>

            {/* 邀请码 */}
            <div style={{
              background: '#F2F2F7',
              borderRadius: '12px',
              padding: '16px',
              textAlign: 'center',
              marginBottom: '12px',
            }}>
              <div style={{ fontSize: '12px', color: '#6E6E73', marginBottom: '8px' }}>你的专属邀请码</div>
              <div style={{
                fontSize: '28px',
                fontWeight: '700',
                letterSpacing: '4px',
                color: '#007AFF',
                fontFamily: 'monospace',
              }}>
                {inviteCode}
              </div>
            </div>

            {/* 邀请链接 */}
            <div style={{
              background: '#F2F2F7',
              borderRadius: '12px',
              padding: '12px 16px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              marginBottom: '12px',
            }}>
              <input
                type="text"
                value={inviteLink}
                readOnly
                style={{
                  flex: 1,
                  border: 'none',
                  background: 'transparent',
                  fontSize: '12px',
                  color: '#1C1C1E',
                  outline: 'none',
                  fontFamily: 'monospace',
                }}
              />
              <button
                onClick={() => copyToClipboard(inviteLink)}
                style={{
                  padding: '8px 16px',
                  background: '#007AFF',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '13px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                {copied ? '✓ 已复制' : '复制链接'}
              </button>
            </div>

            {/* 分享按钮 */}
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={() => copyToClipboard(shareText)}
                style={{
                  flex: 1,
                  padding: '12px',
                  background: '#34C759',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '12px',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: 'pointer',
                }}
              >
                📱 复制分享文案
              </button>
              <button
                onClick={() => {
                  if (navigator.share) {
                    navigator.share({
                      title: inviteConfig.shareTitle,
                      text: inviteConfig.shareDescription,
                      url: inviteLink,
                    });
                  } else {
                    copyToClipboard(shareText);
                  }
                }}
                style={{
                  flex: 1,
                  padding: '12px',
                  background: '#5856D6',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '12px',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: 'pointer',
                }}
              >
                🔗 分享链接
              </button>
            </div>
          </div>

          {/* 邀请流程说明 */}
          <div style={{
            background: '#fff',
            borderRadius: '16px',
            padding: '20px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
          }}>
            <h4 style={{ margin: '0 0 16px', fontSize: '15px', fontWeight: '600', color: '#1C1C1E' }}>
              📖 邀请流程
            </h4>
            {[
              { step: '1', title: '分享邀请链接', desc: '将你的专属邀请链接分享给好友' },
              { step: '2', title: '好友注册账号', desc: '好友通过链接注册即计入邀请' },
              { step: '3', title: '好友购买套餐', desc: '好友完成首次购买后触发奖励' },
              { step: '4', title: '获得代金券奖励', desc: '系统将自动发放代金券到你的账户' },
            ].map((item, i) => (
              <div key={i} style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '12px',
                marginBottom: i < 3 ? '16px' : '0',
                paddingBottom: i < 3 ? '16px' : '0',
                borderBottom: i < 3 ? '1px solid #F2F2F7' : 'none',
              }}>
                <div style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '50%',
                  background: '#007AFF',
                  color: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '13px',
                  fontWeight: '700',
                  flexShrink: 0,
                }}>
                  {item.step}
                </div>
                <div>
                  <div style={{ fontSize: '14px', fontWeight: '600', color: '#1C1C1E' }}>{item.title}</div>
                  <div style={{ fontSize: '12px', color: '#6E6E73', marginTop: '2px' }}>{item.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 我的代金券 Tab */}
      {activeTab === 'vouchers' && (
        <div>
          {userVouchers.length === 0 ? (
            <div style={{
              background: '#fff',
              borderRadius: '16px',
              padding: '40px 20px',
              textAlign: 'center',
              boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
            }}>
              <div style={{ fontSize: '48px', marginBottom: '12px' }}>🎫</div>
              <div style={{ fontSize: '15px', fontWeight: '600', color: '#1C1C1E', marginBottom: '4px' }}>暂无代金券</div>
              <div style={{ fontSize: '13px', color: '#6E6E73' }}>邀请好友购买套餐即可获得代金券奖励</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {userVouchers.map(voucher => {
                const isExpired = voucher.status === 'expired' || new Date(voucher.expiresAt) < new Date();
                const statusColor = voucher.status === 'used' ? '#8E8E93' : isExpired ? '#FF3B30' : '#34C759';
                const statusText = voucher.status === 'used' ? '已使用' : isExpired ? '已过期' : '可使用';

                return (
                  <div key={voucher.id} style={{
                    background: '#fff',
                    borderRadius: '16px',
                    overflow: 'hidden',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
                    opacity: voucher.status === 'used' || isExpired ? 0.6 : 1,
                  }}>
                    <div style={{
                      display: 'flex',
                      alignItems: 'stretch',
                    }}>
                      {/* 左侧金额 */}
                      <div style={{
                        width: '100px',
                        background: voucher.status === 'used' ? '#F2F2F7' : isExpired ? '#FFEBEE' : 'linear-gradient(135deg, #FF9500, #FF6B00)',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '16px 8px',
                      }}>
                        <div style={{ fontSize: '12px', color: voucher.status === 'used' || isExpired ? '#8E8E93' : '#fff', marginBottom: '4px' }}>
                          {voucher.status === 'used' || isExpired ? '' : '¥'}
                        </div>
                        <div style={{
                          fontSize: '28px',
                          fontWeight: '700',
                          color: voucher.status === 'used' || isExpired ? '#8E8E93' : '#fff',
                        }}>
                          {voucher.amount.toFixed(2)}
                        </div>
                        <div style={{
                          fontSize: '10px',
                          color: statusColor,
                          background: '#fff',
                          padding: '2px 8px',
                          borderRadius: '10px',
                          marginTop: '4px',
                          fontWeight: '600',
                        }}>
                          {statusText}
                        </div>
                      </div>

                      {/* 右侧信息 */}
                      <div style={{ flex: 1, padding: '16px' }}>
                        <div style={{ fontSize: '14px', fontWeight: '600', color: '#1C1C1E', marginBottom: '4px' }}>
                          {voucher.name}
                        </div>
                        <div style={{ fontSize: '12px', color: '#8E8E93', marginBottom: '8px' }}>
                          {voucher.description}
                        </div>
                        <div style={{ fontSize: '11px', color: '#AEAEB2' }}>
                          <div>券码：{voucher.code}</div>
                          <div>有效期至：{new Date(voucher.expiresAt).toLocaleDateString('zh-CN')}</div>
                          {voucher.sourceType && <div>来源：{voucher.sourceType}</div>}
                          {voucher.usedAt && <div>使用时间：{new Date(voucher.usedAt).toLocaleDateString('zh-CN')}</div>}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* 邀请记录 Tab */}
      {activeTab === 'history' && (
        <div>
          {userInvitations.length === 0 ? (
            <div style={{
              background: '#fff',
              borderRadius: '16px',
              padding: '40px 20px',
              textAlign: 'center',
              boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
            }}>
              <div style={{ fontSize: '48px', marginBottom: '12px' }}>📋</div>
              <div style={{ fontSize: '15px', fontWeight: '600', color: '#1C1C1E', marginBottom: '4px' }}>暂无邀请记录</div>
              <div style={{ fontSize: '13px', color: '#8E8E93' }}>分享你的邀请链接开始邀请好友吧</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {userInvitations.map(inv => {
                const statusInfo = statusMap[inv.status] || statusMap.pending;
                return (
                  <div key={inv.id} style={{
                    background: '#fff',
                    borderRadius: '16px',
                    padding: '16px',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{
                          width: '40px',
                          height: '40px',
                          borderRadius: '50%',
                          background: '#F2F2F7',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '18px',
                        }}>
                          👤
                        </div>
                        <div>
                          <div style={{ fontSize: '14px', fontWeight: '600', color: '#1C1C1E' }}>{inv.inviteeName}</div>
                          <div style={{ fontSize: '12px', color: '#8E8E93' }}>{inv.inviteeEmail}</div>
                        </div>
                      </div>
                      <span style={{
                        padding: '4px 10px',
                        borderRadius: '10px',
                        fontSize: '11px',
                        fontWeight: '600',
                        color: statusInfo.color,
                        background: statusInfo.bg,
                      }}>
                        {statusInfo.label}
                      </span>
                    </div>
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      fontSize: '12px',
                      color: '#8E8E93',
                      borderTop: '1px solid #F2F2F7',
                      paddingTop: '10px',
                    }}>
                      <span>注册时间：{inv.registeredAt ? new Date(inv.registeredAt).toLocaleDateString('zh-CN') : '-'}</span>
                      <span>
                        {inv.purchaseAmount ? (
                          <>消费 ¥{inv.purchaseAmount.toFixed(2)} → 奖励 ¥{inv.rewardAmount.toFixed(2)}</>
                        ) : (
                          '尚未购买'
                        )}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
