import { useState } from 'react';
import { useApp } from '../store';
import { InviteConfig } from '../types';

export default function InviteConfigPanel() {
  const { inviteConfig, updateInviteConfig, invitations, vouchers } = useApp();
  const [activeTab, setActiveTab] = useState<'config' | 'invitations' | 'vouchers'>('config');
  const [editing, setEditing] = useState(false);
  const [formData, setFormData] = useState<Partial<InviteConfig>>(inviteConfig);

  const handleSave = () => {
    if (formData) {
      updateInviteConfig(formData);
      setEditing(false);
    }
  };

  const handleCancel = () => {
    setFormData(inviteConfig);
    setEditing(false);
  };

  const totalInvites = invitations.length;
  const successfulInvites = invitations.filter(i => i.status === 'rewarded').length;
  const totalRewards = invitations.reduce((sum, i) => sum + (i.rewardAmount || 0), 0);
  const availableVouchers = vouchers.filter(v => v.status === 'available').length;

  const statusMap: Record<string, { label: string; color: string; bg: string }> = {
    pending: { label: '待注册', color: '#6E6E73', bg: '#F2F2F7' },
    registered: { label: '已注册', color: '#0066D6', bg: '#E5F1FF' },
    purchased: { label: '已购买', color: '#E68600', bg: '#FFF3E0' },
    rewarded: { label: '已奖励', color: '#28A745', bg: '#E8F5E9' },
    expired: { label: '已过期', color: '#D32F2F', bg: '#FFEBEE' },
  };

  const voucherStatusMap: Record<string, { label: string; color: string; bg: string }> = {
    available: { label: '可使用', color: '#28A745', bg: '#E8F5E9' },
    used: { label: '已使用', color: '#6E6E73', bg: '#F2F2F7' },
    expired: { label: '已过期', color: '#D32F2F', bg: '#FFEBEE' },
  };

  return (
    <div style={{ padding: '20px' }}>
      {/* 统计卡片 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '24px' }}>
        {[
          { label: '总邀请数', value: totalInvites, icon: '👥', color: '#007AFF' },
          { label: '成功邀请', value: successfulInvites, icon: '✅', color: '#34C759' },
          { label: '发放奖励', value: `¥${totalRewards.toFixed(2)}`, icon: '💰', color: '#FF9500' },
          { label: '可用代金券', value: availableVouchers, icon: '🎫', color: '#AF52DE' },
        ].map((stat, i) => (
          <div key={i} style={{
            background: '#fff',
            borderRadius: '16px',
            padding: '20px',
            boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ fontSize: '13px', color: '#8E8E93' }}>{stat.label}</span>
              <span style={{ fontSize: '20px' }}>{stat.icon}</span>
            </div>
            <div style={{ fontSize: '24px', fontWeight: '700', color: stat.color }}>{stat.value}</div>
          </div>
        ))}
      </div>

      {/* Tab 切换 */}
      <div style={{ display: 'flex', gap: '4px', marginBottom: '20px', background: '#F2F2F7', borderRadius: '12px', padding: '4px' }}>
        {[
          { key: 'config' as const, label: '⚙️ 邀请配置', icon: '⚙️' },
          { key: 'invitations' as const, label: '📋 邀请记录', icon: '📋' },
          { key: 'vouchers' as const, label: '🎫 代金券管理', icon: '🎫' },
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            style={{
              flex: 1,
              padding: '12px',
              border: 'none',
              borderRadius: '10px',
              background: activeTab === tab.key ? '#fff' : 'transparent',
              color: activeTab === tab.key ? '#007AFF' : '#8E8E93',
              fontSize: '14px',
              fontWeight: activeTab === tab.key ? '600' : '400',
              cursor: 'pointer',
              boxShadow: activeTab === tab.key ? '0 2px 8px rgba(0,0,0,0.08)' : 'none',
              transition: 'all 0.2s',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* 邀请配置 Tab */}
      {activeTab === 'config' && (
        <div style={{
          background: '#fff',
          borderRadius: '16px',
          padding: '24px',
          boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
            <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '600', color: '#1C1C1E' }}>邀请系统配置</h3>
            {!editing ? (
              <button
                onClick={() => { setEditing(true); setFormData(inviteConfig); }}
                style={{
                  padding: '8px 20px',
                  background: '#007AFF',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '10px',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: 'pointer',
                }}
              >
                ✏️ 编辑配置
              </button>
            ) : (
              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={handleCancel} style={{
                  padding: '8px 20px',
                  background: '#F2F2F7',
                  color: '#8E8E93',
                  border: 'none',
                  borderRadius: '10px',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: 'pointer',
                }}>
                  取消
                </button>
                <button onClick={handleSave} style={{
                  padding: '8px 20px',
                  background: '#34C759',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '10px',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: 'pointer',
                }}>
                  💾 保存配置
                </button>
              </div>
            )}
          </div>

          {/* 启用开关 */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '16px',
            background: inviteConfig.enabled ? '#E8F5E9' : '#F2F2F7',
            borderRadius: '12px',
            marginBottom: '20px',
          }}>
            <div>
              <div style={{ fontSize: '15px', fontWeight: '600', color: '#1C1C1E' }}>邀请系统</div>
              <div style={{ fontSize: '13px', color: '#8E8E93' }}>开启后用户可通过邀请链接获得奖励</div>
            </div>
            <button
              onClick={() => editing && updateInviteConfig({ enabled: !inviteConfig.enabled })}
              disabled={!editing}
              style={{
                width: '52px',
                height: '32px',
                borderRadius: '16px',
                border: 'none',
                background: inviteConfig.enabled ? '#34C759' : '#E5E5EA',
                cursor: editing ? 'pointer' : 'not-allowed',
                position: 'relative',
                transition: 'all 0.3s',
              }}
            >
              <div style={{
                width: '28px',
                height: '28px',
                borderRadius: '50%',
                background: '#fff',
                position: 'absolute',
                top: '2px',
                left: inviteConfig.enabled ? '22px' : '2px',
                transition: 'all 0.3s',
                boxShadow: '0 2px 4px rgba(0,0,0,0.15)',
              }} />
            </button>
          </div>

          {!inviteConfig.enabled && (
            <div style={{
              padding: '12px 16px',
              background: '#FFF3E0',
              borderRadius: '10px',
              fontSize: '13px',
              color: '#FF9500',
              marginBottom: '20px',
            }}>
              ⚠️ 邀请系统已关闭，用户将无法使用邀请功能
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            {/* 奖励方式 */}
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#1C1C1E', marginBottom: '8px' }}>
                奖励方式
              </label>
              {editing ? (
                <select
                  value={formData.rewardType}
                  onChange={e => setFormData(prev => ({ ...prev, rewardType: e.target.value as 'fixed' | 'percentage' }))}
                  style={{
                    width: '100%',
                    padding: '12px',
                    border: '1px solid #E5E5EA',
                    borderRadius: '10px',
                    fontSize: '14px',
                    background: '#fff',
                    color: '#1C1C1E',
                  }}
                >
                  <option value="percentage">按百分比 (%)</option>
                  <option value="fixed">固定金额 (¥)</option>
                </select>
              ) : (
                <div style={{
                  padding: '12px',
                  background: '#F2F2F7',
                  borderRadius: '10px',
                  fontSize: '14px',
                  color: '#1C1C1E',
                }}>
                  {inviteConfig.rewardType === 'percentage' ? '按百分比' : '固定金额'}
                </div>
              )}
            </div>

            {/* 奖励金额/百分比 */}
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#1C1C1E', marginBottom: '8px' }}>
                奖励{inviteConfig.rewardType === 'percentage' ? '百分比 (%)' : '金额 (¥)'}
              </label>
              {editing ? (
                <input
                  type="number"
                  value={formData.rewardAmount}
                  onChange={e => setFormData(prev => ({ ...prev, rewardAmount: parseFloat(e.target.value) || 0 }))}
                  style={{
                    width: '100%',
                    padding: '12px',
                    border: '1px solid #E5E5EA',
                    borderRadius: '10px',
                    fontSize: '14px',
                    background: '#fff',
                    color: '#1C1C1E',
                  }}
                />
              ) : (
                <div style={{
                  padding: '12px',
                  background: '#F2F2F7',
                  borderRadius: '10px',
                  fontSize: '14px',
                  color: '#1C1C1E',
                }}>
                  {inviteConfig.rewardType === 'percentage' ? `${inviteConfig.rewardAmount}%` : `¥${inviteConfig.rewardAmount}`}
                </div>
              )}
            </div>

            {/* 单次最大奖励 */}
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#1C1C1E', marginBottom: '8px' }}>
                单次最大奖励 (¥)
              </label>
              {editing ? (
                <input
                  type="number"
                  value={formData.maxRewardPerInvite}
                  onChange={e => setFormData(prev => ({ ...prev, maxRewardPerInvite: parseFloat(e.target.value) || 0 }))}
                  style={{
                    width: '100%',
                    padding: '12px',
                    border: '1px solid #E5E5EA',
                    borderRadius: '10px',
                    fontSize: '14px',
                    background: '#fff',
                    color: '#1C1C1E',
                  }}
                />
              ) : (
                <div style={{
                  padding: '12px',
                  background: '#F2F2F7',
                  borderRadius: '10px',
                  fontSize: '14px',
                  color: '#1C1C1E',
                }}>
                  ¥{inviteConfig.maxRewardPerInvite}
                </div>
              )}
            </div>

            {/* 每日最大奖励 */}
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#1C1C1E', marginBottom: '8px' }}>
                每日最大奖励 (¥)
              </label>
              {editing ? (
                <input
                  type="number"
                  value={formData.maxRewardPerDay}
                  onChange={e => setFormData(prev => ({ ...prev, maxRewardPerDay: parseFloat(e.target.value) || 0 }))}
                  style={{
                    width: '100%',
                    padding: '12px',
                    border: '1px solid #E5E5EA',
                    borderRadius: '10px',
                    fontSize: '14px',
                    background: '#fff',
                    color: '#1C1C1E',
                  }}
                />
              ) : (
                <div style={{
                  padding: '12px',
                  background: '#F2F2F7',
                  borderRadius: '10px',
                  fontSize: '14px',
                  color: '#1C1C1E',
                }}>
                  ¥{inviteConfig.maxRewardPerDay}
                </div>
              )}
            </div>

            {/* 最低消费金额 */}
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#1C1C1E', marginBottom: '8px' }}>
                被邀请人最低消费 (¥)
              </label>
              {editing ? (
                <input
                  type="number"
                  value={formData.minPurchaseAmount}
                  onChange={e => setFormData(prev => ({ ...prev, minPurchaseAmount: parseFloat(e.target.value) || 0 }))}
                  style={{
                    width: '100%',
                    padding: '12px',
                    border: '1px solid #E5E5EA',
                    borderRadius: '10px',
                    fontSize: '14px',
                    background: '#fff',
                    color: '#1C1C1E',
                  }}
                />
              ) : (
                <div style={{
                  padding: '12px',
                  background: '#F2F2F7',
                  borderRadius: '10px',
                  fontSize: '14px',
                  color: '#1C1C1E',
                }}>
                  ¥{inviteConfig.minPurchaseAmount}
                </div>
              )}
            </div>

            {/* 代金券有效期 */}
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#1C1C1E', marginBottom: '8px' }}>
                代金券有效期 (天)
              </label>
              {editing ? (
                <input
                  type="number"
                  value={formData.rewardExpiry}
                  onChange={e => setFormData(prev => ({ ...prev, rewardExpiry: parseInt(e.target.value) || 365 }))}
                  style={{
                    width: '100%',
                    padding: '12px',
                    border: '1px solid #E5E5EA',
                    borderRadius: '10px',
                    fontSize: '14px',
                    background: '#fff',
                    color: '#1C1C1E',
                  }}
                />
              ) : (
                <div style={{
                  padding: '12px',
                  background: '#F2F2F7',
                  borderRadius: '10px',
                  fontSize: '14px',
                  color: '#1C1C1E',
                }}>
                  {inviteConfig.rewardExpiry} 天
                </div>
              )}
            </div>
          </div>

          {/* 代金券名称和描述 */}
          <div style={{ marginTop: '16px' }}>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#1C1C1E', marginBottom: '8px' }}>
              代金券名称
            </label>
            {editing ? (
              <input
                type="text"
                value={formData.voucherName}
                onChange={e => setFormData(prev => ({ ...prev, voucherName: e.target.value }))}
                style={{
                  width: '100%',
                  padding: '12px',
                  border: '1px solid #E5E5EA',
                  borderRadius: '10px',
                  fontSize: '14px',
                  background: '#fff',
                  color: '#1C1C1E',
                  boxSizing: 'border-box',
                }}
              />
            ) : (
              <div style={{
                padding: '12px',
                background: '#F2F2F7',
                borderRadius: '10px',
                fontSize: '14px',
                color: '#1C1C1E',
              }}>
                {inviteConfig.voucherName}
              </div>
            )}
          </div>

          <div style={{ marginTop: '16px' }}>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#1C1C1E', marginBottom: '8px' }}>
              代金券描述
            </label>
            {editing ? (
              <textarea
                value={formData.voucherDescription}
                onChange={e => setFormData(prev => ({ ...prev, voucherDescription: e.target.value }))}
                rows={2}
                style={{
                  width: '100%',
                  padding: '12px',
                  border: '1px solid #E5E5EA',
                  borderRadius: '10px',
                  fontSize: '14px',
                  background: '#fff',
                  color: '#1C1C1E',
                  resize: 'vertical',
                  boxSizing: 'border-box',
                }}
              />
            ) : (
              <div style={{
                padding: '12px',
                background: '#F2F2F7',
                borderRadius: '10px',
                fontSize: '14px',
                color: '#1C1C1E',
              }}>
                {inviteConfig.voucherDescription}
              </div>
            )}
          </div>

          {/* 分享文案配置 */}
          <div style={{ marginTop: '16px' }}>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#1C1C1E', marginBottom: '8px' }}>
              邀请按钮文案
            </label>
            {editing ? (
              <input
                type="text"
                value={formData.inviteButtonText}
                onChange={e => setFormData(prev => ({ ...prev, inviteButtonText: e.target.value }))}
                style={{
                  width: '100%',
                  padding: '12px',
                  border: '1px solid #E5E5EA',
                  borderRadius: '10px',
                  fontSize: '14px',
                  background: '#fff',
                  color: '#1C1C1E',
                  boxSizing: 'border-box',
                }}
              />
            ) : (
              <div style={{
                padding: '12px',
                background: '#F2F2F7',
                borderRadius: '10px',
                fontSize: '14px',
                color: '#1C1C1E',
              }}>
                {inviteConfig.inviteButtonText}
              </div>
            )}
          </div>

          <div style={{ marginTop: '16px' }}>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#1C1C1E', marginBottom: '8px' }}>
              分享标题
            </label>
            {editing ? (
              <input
                type="text"
                value={formData.shareTitle}
                onChange={e => setFormData(prev => ({ ...prev, shareTitle: e.target.value }))}
                style={{
                  width: '100%',
                  padding: '12px',
                  border: '1px solid #E5E5EA',
                  borderRadius: '10px',
                  fontSize: '14px',
                  background: '#fff',
                  color: '#1C1C1E',
                  boxSizing: 'border-box',
                }}
              />
            ) : (
              <div style={{
                padding: '12px',
                background: '#F2F2F7',
                borderRadius: '10px',
                fontSize: '14px',
                color: '#1C1C1E',
              }}>
                {inviteConfig.shareTitle}
              </div>
            )}
          </div>

          <div style={{ marginTop: '16px' }}>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#1C1C1E', marginBottom: '8px' }}>
              分享描述
            </label>
            {editing ? (
              <textarea
                value={formData.shareDescription}
                onChange={e => setFormData(prev => ({ ...prev, shareDescription: e.target.value }))}
                rows={2}
                style={{
                  width: '100%',
                  padding: '12px',
                  border: '1px solid #E5E5EA',
                  borderRadius: '10px',
                  fontSize: '14px',
                  background: '#fff',
                  color: '#1C1C1E',
                  resize: 'vertical',
                  boxSizing: 'border-box',
                }}
              />
            ) : (
              <div style={{
                padding: '12px',
                background: '#F2F2F7',
                borderRadius: '10px',
                fontSize: '14px',
                color: '#1C1C1E',
              }}>
                {inviteConfig.shareDescription}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 邀请记录 Tab */}
      {activeTab === 'invitations' && (
        <div style={{
          background: '#fff',
          borderRadius: '16px',
          overflow: 'hidden',
          boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
        }}>
          <div style={{ padding: '20px 24px', borderBottom: '1px solid #F2F2F7' }}>
            <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '600', color: '#1C1C1E' }}>邀请记录</h3>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#F8F8FA' }}>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: '#6E6E73' }}>邀请人</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: '#6E6E73' }}>被邀请人</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: '#6E6E73' }}>邀请码</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: '#6E6E73' }}>状态</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: '#6E6E73' }}>消费金额</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: '#6E6E73' }}>奖励金额</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: '#6E6E73' }}>时间</th>
                </tr>
              </thead>
              <tbody>
                {invitations.map(inv => {
                  const statusInfo = statusMap[inv.status] || statusMap.pending;
                  return (
                    <tr key={inv.id} style={{ borderBottom: '1px solid #F2F2F7' }}>
                      <td style={{ padding: '12px 16px', fontSize: '14px', color: '#1C1C1E' }}>{inv.inviterName}</td>
                      <td style={{ padding: '12px 16px', fontSize: '14px', color: '#1C1C1E' }}>
                        <div>{inv.inviteeName}</div>
                        <div style={{ fontSize: '12px', color: '#8E8E93' }}>{inv.inviteeEmail}</div>
                      </td>
                      <td style={{ padding: '12px 16px', fontSize: '13px', fontFamily: 'monospace', color: '#007AFF' }}>{inv.inviteCode}</td>
                      <td style={{ padding: '12px 16px' }}>
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
                      </td>
                      <td style={{ padding: '12px 16px', fontSize: '14px', color: '#1C1C1E' }}>
                        {inv.purchaseAmount ? `¥${inv.purchaseAmount.toFixed(2)}` : '-'}
                      </td>
                      <td style={{ padding: '12px 16px', fontSize: '14px', fontWeight: '600', color: '#FF9500' }}>
                        {inv.rewardAmount ? `¥${inv.rewardAmount.toFixed(2)}` : '-'}
                      </td>
                      <td style={{ padding: '12px 16px', fontSize: '12px', color: '#8E8E93' }}>
                        {new Date(inv.createdAt).toLocaleDateString('zh-CN')}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 代金券管理 Tab */}
      {activeTab === 'vouchers' && (
        <div style={{
          background: '#fff',
          borderRadius: '16px',
          overflow: 'hidden',
          boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
        }}>
          <div style={{ padding: '20px 24px', borderBottom: '1px solid #F2F2F7' }}>
            <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '600', color: '#1C1C1E' }}>代金券管理</h3>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#F8F8FA' }}>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: '#8E8E93' }}>券码</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: '#8E8E93' }}>名称</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: '#8E8E93' }}>用户</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: '#8E8E93' }}>面额</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: '#8E8E93' }}>状态</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: '#8E8E93' }}>来源</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: '#8E8E93' }}>有效期</th>
                </tr>
              </thead>
              <tbody>
                {vouchers.map(v => {
                  const statusInfo = voucherStatusMap[v.status] || voucherStatusMap.available;
                  return (
                    <tr key={v.id} style={{ borderBottom: '1px solid #F2F2F7' }}>
                      <td style={{ padding: '12px 16px', fontSize: '12px', fontFamily: 'monospace', color: '#007AFF' }}>{v.code}</td>
                      <td style={{ padding: '12px 16px', fontSize: '14px', color: '#1C1C1E' }}>{v.name}</td>
                      <td style={{ padding: '12px 16px', fontSize: '14px', color: '#1C1C1E' }}>
                        {v.userId}
                      </td>
                      <td style={{ padding: '12px 16px', fontSize: '16px', fontWeight: '700', color: '#FF9500' }}>¥{v.amount.toFixed(2)}</td>
                      <td style={{ padding: '12px 16px' }}>
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
                      </td>
                      <td style={{ padding: '12px 16px', fontSize: '13px', color: '#8E8E93' }}>{v.sourceType}</td>
                      <td style={{ padding: '12px 16px', fontSize: '12px', color: '#8E8E93' }}>
                        {new Date(v.expiresAt).toLocaleDateString('zh-CN')}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
