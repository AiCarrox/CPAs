export const fmtPercent = (value: number) => `${Math.round(value)}%`;

export const fmtNumber = (value: number) => value.toLocaleString('en-US');

export const fmtDateTime = (value: string | null) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  const hours = `${date.getHours()}`.padStart(2, '0');
  const minutes = `${date.getMinutes()}`.padStart(2, '0');
  return `${month}/${day} ${hours}:${minutes}`;
};

export const quotaColor = (percent: number | null): string => {
  if (percent === null) return 'var(--muted)';
  if (percent > 60) return 'var(--success)';
  if (percent > 20) return 'var(--warning)';
  return 'var(--danger)';
};
