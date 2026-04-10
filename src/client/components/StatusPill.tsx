export function StatusPill({ variant, children }: { variant: 'live' | 'warning' | 'muted'; children: React.ReactNode }) {
  const color = variant === 'live' ? 'var(--success)' : variant === 'warning' ? 'var(--warning)' : 'var(--muted)';
  return <span style={{ color, fontSize: 12, fontWeight: 600, textTransform: 'uppercase' }}>{children}</span>;
}
