import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';

import RequireAuth from './components/RequireAuth';

const LoginPage = lazy(() => import('./pages/LoginPage'));
const ResetPasswordPage = lazy(() => import('./pages/ResetPasswordPage'));
const HomePage = lazy(() => import('./pages/HomePage'));
const AccountPage = lazy(() => import('./pages/AccountPage'));

const RouteLoading = () => <div className="ssoRouteLoading" role="status" aria-label="Đang tải" />;

const lazyRoute = (page: JSX.Element) => <Suspense fallback={<RouteLoading />}>{page}</Suspense>;

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={lazyRoute(<LoginPage />)} />
      <Route path="/reset-password" element={lazyRoute(<ResetPasswordPage />)} />

      {/* Khu vực cần đăng nhập - RequireAuth gọi /me, 401 -> /login */}
      <Route element={<RequireAuth />}>
        <Route path="/" element={lazyRoute(<HomePage />)} />
        <Route path="/account" element={lazyRoute(<AccountPage />)} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
