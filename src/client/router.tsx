import { useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router';
import { useAuth } from './hooks/useAuth';
import { PublicPage } from './pages/PublicPage';
import { AdminPage } from './pages/AdminPage';
import { LoginPage } from './pages/LoginPage';

function AdminGuard() {
  const { state, check, login, error, loading } = useAuth();

  useEffect(() => { void check(); }, [check]);

  if (state === 'checking') {
    return <div style={{ padding: 20, fontSize: 13, color: 'var(--muted)' }}>正在检查会话...</div>;
  }
  if (state === 'login') {
    return <LoginPage onLogin={login} error={error} loading={loading} />;
  }
  return <AdminPage />;
}

export function AppRouter() {
  return (
    <Routes>
      <Route path="/" element={<PublicPage />} />
      <Route path="/admin" element={<AdminGuard />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
