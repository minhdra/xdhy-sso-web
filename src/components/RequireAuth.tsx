import { Spin } from 'antd';
import { useEffect } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';

import { useSessionStore } from '../store/session';

// Bọc các route cần đăng nhập (/ và /account). Gọi /me 1 lần lúc mount; chưa
// xong -> spinner; 401 -> về /login kèm ?redirect để quay lại; ok -> render
// route con.
export default function RequireAuth() {
  const status = useSessionStore((s) => s.status);
  const fetchMe = useSessionStore((s) => s.fetchMe);
  const location = useLocation();

  useEffect(() => {
    void fetchMe();
  }, [fetchMe]);

  if (status === 'loading') {
    return (
      <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center' }}>
        <Spin size="large" />
      </div>
    );
  }

  if (status === 'unauthenticated') {
    const redirect = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/login?redirect=${redirect}`} replace />;
  }

  return <Outlet />;
}
