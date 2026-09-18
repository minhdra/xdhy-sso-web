import { useEffect } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';

import { useSessionStore } from '../store/session';
import { PageLoading } from './PageLoading';
import { SessionErrorState } from './SessionErrorState';

// Bọc các route cần đăng nhập (/ và /account). Gọi /me 1 lần lúc mount; chưa
// xong -> spinner; 401 -> về /login kèm ?redirect để quay lại; ok -> render
// route con.
export default function RequireAuth() {
  const status = useSessionStore((s) => s.status);
  const fetchMe = useSessionStore((s) => s.fetchMe);
  const retry = useSessionStore((s) => s.retry);
  const error = useSessionStore((s) => s.error);
  const location = useLocation();

  useEffect(() => {
    void fetchMe();
  }, [fetchMe]);

  if (status === 'loading') {
    return <PageLoading />;
  }

  if (status === 'unauthenticated') {
    const redirect = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/login?redirect=${redirect}`} replace />;
  }

  if (status === 'error') {
    return <SessionErrorState error={error} onRetry={() => void retry()} />;
  }

  return <Outlet />;
}
