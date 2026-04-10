import type { OverviewAccount } from '../../shared/types';
import { fmtPercent, fmtDateTime, quotaColor } from '../lib/format';
import { StatusPill } from './StatusPill';
import { QuotaBar } from './QuotaBar';

export function AccountCard({ account, accent, publicMode, compact }: { account: OverviewAccount; accent: string; publicMode?: boolean; compact?: boolean }) {
  return (
    <article style={{ border: '1px solid var(--line)', borderLeft: `3px solid ${accent}`, padding: '4px 6px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
        <div>
          <strong style={{ fontSize: 14 }}>{account.label || account.email || account.name}</strong>
        </div>
        <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
          <StatusPill variant={account.disabled ? 'muted' : account.unavailable ? 'warning' : 'live'}>
            {account.disabled ? '已禁用' : account.unavailable ? '异常' : '正常'}
          </StatusPill>
          {account.quota_state.exceeded && <StatusPill variant="warning">耗尽</StatusPill>}
        </div>
      </div>

      {!compact && (
        <div style={{ fontSize: 12, color: 'var(--muted)', display: 'flex', gap: 10, marginBottom: 6, flexWrap: 'wrap' }}>
          {!publicMode && account.quota.plan.label && <span>{account.quota.plan.label}</span>}
          <span>{fmtDateTime(account.last_refresh)}</span>
        </div>
      )}

      {account.quota.items.length === 0 ? (
        <div style={{ fontSize: 13, color: 'var(--muted)' }}>暂无配额数据</div>
      ) : compact ? (
        account.quota.items.map((item) => {
          const color = quotaColor(item.remaining_percent);
          return (
            <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, lineHeight: '20px' }}>
              <span>{item.label}</span>
              <div style={{ display: 'flex', gap: 10 }}>
                <span style={{ color, fontWeight: 600 }}>{item.remaining_percent === null ? '--' : fmtPercent(item.remaining_percent)}</span>
                <span style={{ color: 'var(--muted)', fontSize: 12 }}>{fmtDateTime(item.reset_at)}</span>
              </div>
            </div>
          );
        })
      ) : (
        account.quota.items.map((item) => <QuotaBar key={item.id} item={item} />)
      )}

      {!compact && account.quota.extra.map((item) => (
        <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginTop: 2 }}>
          <span>{item.label}</span>
          <strong>
            {item.used_amount !== null && item.limit_amount !== null
              ? `${item.used_amount} / ${item.limit_amount} ${item.unit ?? ''}`.trim()
              : `${item.limit_amount ?? '--'} ${item.unit ?? ''}`.trim()}
          </strong>
        </div>
      ))}
    </article>
  );
}
