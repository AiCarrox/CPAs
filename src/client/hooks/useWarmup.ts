import { useState, useCallback } from 'react';
import type { WarmupConfig } from '../../shared/types';
import * as api from '../api';

const defaultConfig: WarmupConfig = { entries: [], states: {} };

export function useWarmup() {
  const [config, setConfig] = useState<WarmupConfig>(defaultConfig);

  const loadConfig = useCallback(async () => {
    try {
      const res = await api.fetchWarmupConfig();
      setConfig(res.config);
    } catch {
      // optional
    }
  }, []);

  const save = useCallback(async (entries: WarmupConfig['entries']) => {
    const res = await api.saveWarmupConfig(entries);
    setConfig(res.config);
  }, []);

  const test = useCallback(async (entry: Parameters<typeof api.testWarmupEntry>[0]) => {
    return api.testWarmupEntry(entry);
  }, []);

  return { config, loadConfig, save, test };
}
