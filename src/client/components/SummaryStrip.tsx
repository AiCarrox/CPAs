import type { OverviewResponse } from '../../shared/types';
import { fmtNumber } from '../lib/format';

export function SummaryStrip({ summary }: { summary: OverviewResponse['summary'] }) {
  const items = [
    { label: '站点', value: `${summary.healthy_site_count}/${summary.site_count}` },
    { label: '账号', value: String(summary.active_account_count) },
    { label: '24h 请求', value: fmtNumber(summary.total_requests_24h) },
    { label: '24h Tokens', value: fmtNumber(summary.total_tokens_24h) },
  ];
  return (
    <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', padding: '8px 0', borderBottom: '1px solid var(--line)' }}>
      {items.map((item) => (
        <div key={item.label} style={{ fontSize: 13 }}>
          <span style={{ color: 'var(--muted)', marginRight: 4 }}>{item.label}</span>
          <strong>{item.value}</strong>
        </div>
      ))}
    </div>
  );
}
