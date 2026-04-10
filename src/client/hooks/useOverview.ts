import { useState, useEffect, useCallback, useRef } from 'react';
import type { OverviewResponse } from '../../shared/types';
import * as api from '../api';

export function useOverview(mode: 'admin' | 'public', refreshIntervalMs: number) {
  const [overview, setOverview] = useState<OverviewResponse | null>(null);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const activeRef = useRef(true);

  const load = useCallback(async (force = false) => {
    setRefreshing(true);
    try {
      const data =
        mode === 'public'
          ? await api.fetchPublicOverview()
          : force
            ? await api.refreshOverview()
            : await api.fetchOverview();
      if (activeRef.current) { setOverview(data); setError(''); }
    } catch (e) {
      if (activeRef.current) {
        const msg = e instanceof Error ? e.message : 'Failed to load';
        if (mode === 'public' && !overview) setError(msg);
        else if (mode === 'admin') setError(msg);
      }
    } finally {
      if (activeRef.current) setRefreshing(false);
    }
  }, [mode]);

  useEffect(() => {
    activeRef.current = true;
    return () => { activeRef.current = false; };
  }, []);

  useEffect(() => {
    if (!refreshIntervalMs) return;
    const timer = window.setInterval(() => void load(false), refreshIntervalMs);
    return () => window.clearInterval(timer);
  }, [load, refreshIntervalMs]);

  return { overview, error, refreshing, load };
}
