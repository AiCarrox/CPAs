import { useState, useCallback } from 'react';
import * as api from '../api';

type AuthState = 'checking' | 'login' | 'authenticated';

export function useAuth() {
  const [state, setState] = useState<AuthState>('checking');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const check = useCallback(async () => {
    try {
      const session = await api.checkSession();
      setState(session.authenticated ? 'authenticated' : 'login');
    } catch {
      setState('login');
    }
  }, []);

  const login = useCallback(async (password: string) => {
    setLoading(true);
    setError('');
    try {
      await api.login(password);
      setState('authenticated');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Login failed');
      setState('login');
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    await api.logout();
    setState('login');
  }, []);

  return { state, check, login, logout, error, loading };
}
