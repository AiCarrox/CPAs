import type { AlertTarget } from '../../shared/types';

export const providerAccent: Record<string, string> = {
  claude: '#df8455',
  codex: '#c9a352',
  'gemini-cli': '#4a87ff',
  kimi: '#3fa764',
  antigravity: '#2ea7a0',
};

export const refreshIntervalOptions = [
  { value: 60, label: '1 分钟' },
  { value: 300, label: '5 分钟' },
  { value: 600, label: '10 分钟' },
  { value: 1800, label: '30 分钟' },
  { value: 3600, label: '1 小时' },
  { value: 18000, label: '5 小时' },
];

export const alertTargetOptions: Array<{ value: AlertTarget; label: string }> = [
  { value: 'quota_5h', label: '5小时额度' },
  { value: 'quota_week', label: '周额度' },
];
