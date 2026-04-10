import { useState, useCallback } from 'react';
import type { AlertConfig, AlertTestResponse } from '../../shared/types';
import * as api from '../api';

const defaultConfig: AlertConfig = {
  enabled: false,
  channel: 'custom',
  custom_url: '',
  feishu_token: '',
  telegram_bot_token: '',
  telegram_chat_id: '',
  qmsg_key: '',
  rules: [{ id: 'default-rule', enabled: true, threshold: 50, target: 'quota_5h' }],
  refresh_interval_seconds: 300,
};

export function useAlert() {
  const [config, setConfig] = useState<AlertConfig>(defaultConfig);

  const loadConfig = useCallback(async () => {
    try {
      const res = await api.fetchAlertConfig();
      setConfig(res.config);
    } catch {
      // optional — ignore if alert endpoint is unavailable
    }
  }, []);

  const save = useCallback(async (patch: Partial<AlertConfig>) => {
    const res = await api.saveAlertConfig(patch);
    setConfig(res.config);
  }, []);

  const test = useCallback(async (): Promise<AlertTestResponse> => {
    return api.testAlertWebhook();
  }, []);

  return { config, loadConfig, save, test };
}
