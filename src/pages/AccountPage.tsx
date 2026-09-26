import {
  ApartmentOutlined,
  AppstoreOutlined,
  IdcardOutlined,
  LaptopOutlined,
  LockOutlined,
  SafetyCertificateOutlined,
  SyncOutlined,
  TeamOutlined,
} from '@ant-design/icons';
import { App as AntdApp } from 'antd';
import { lazy, Suspense } from 'react';
import { useSearchParams } from 'react-router-dom';

import AppHeader from '../components/AppHeader';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { useSessionStore } from '../store/session';
const ProfilePanel = lazy(() => import('./account/ProfilePanel'));
const PasswordPanel = lazy(() => import('./account/PasswordPanel'));
const SessionsPanel = lazy(() => import('./account/SessionsPanel'));
const AppsAdminPanel = lazy(() => import('./account/AppsAdminPanel'));
const UsersAdminPanel = lazy(() => import('./account/UsersAdminPanel'));
const OrgUnitsAdminPanel = lazy(() => import('./account/OrgUnitsAdminPanel'));
const RolesAdminPanel = lazy(() => import('./account/RolesAdminPanel'));
const SyncAdminPanel = lazy(() => import('./account/SyncAdminPanel'));

const PanelLoading = () => <div className="ssoRouteLoading" role="status" aria-label="Đang tải" />;

const BASE_TABS = [
  { key: 'profile', label: 'Thông tin cá nhân', icon: <IdcardOutlined />, color: '#2563a6' },
  { key: 'password', label: 'Mật khẩu', icon: <LockOutlined />, color: '#5b8def' },
  { key: 'sessions', label: 'Phiên đăng nhập', icon: <LaptopOutlined />, color: '#7c6bd6' },
] as const;

// Chỉ quản trị viên (is_admin, tính lại mỗi lần /me - xem requireAdmin.ts bên
// api-sso) mới thấy các tab này. BE tự chặn 403 nếu ai đó gọi thẳng API, tab
// ẩn ở đây chỉ là UX - không phải lớp bảo vệ duy nhất. Người dùng/tổ chức/nhóm
// quyền chuyển từ build-web sang đây 26/09/2026.
const ADMIN_TABS = [
  { key: 'apps-admin', label: 'Quản lý ứng dụng', icon: <AppstoreOutlined />, color: '#c44a1a' },
  { key: 'users-admin', label: 'Người dùng', icon: <TeamOutlined />, color: '#0f8a6c' },
  { key: 'org-admin', label: 'Tổ chức', icon: <ApartmentOutlined />, color: '#b7791f' },
  { key: 'roles-admin', label: 'Nhóm quyền', icon: <SafetyCertificateOutlined />, color: '#9b3fb5' },
  { key: 'sync-admin', label: 'Đồng bộ', icon: <SyncOutlined />, color: '#4a6072' },
] as const;

export default function AccountPage() {
  useDocumentTitle('Quản lý tài khoản');
  const [params, setParams] = useSearchParams();
  const isAdmin = useSessionStore((s) => s.user?.is_admin ?? false);
  const TABS = isAdmin ? [...BASE_TABS, ...ADMIN_TABS] : BASE_TABS;
  const tab = TABS.some((t) => t.key === params.get('tab')) ? params.get('tab')! : 'profile';
  AntdApp.useApp();

  return (
    <div className="ssoShell">
      <AppHeader />
      <main className="ssoAccount">
        <h1 className="ssoAccount-title">Quản lý tài khoản</h1>
        <p className="ssoAccount-sub">Thông tin và bảo mật cho tài khoản XDHY của bạn.</p>

        <div className="ssoAccount-body">
          <nav className="ssoAccount-nav">
            {TABS.map((t) => (
              <button
                key={t.key}
                type="button"
                className={t.key === tab ? 'is-active' : ''}
                onClick={() => setParams({ tab: t.key })}
              >
                <span className="ssoAccount-navIcon" style={{ background: t.color }}>
                  {t.icon}
                </span>
                <span>{t.label}</span>
              </button>
            ))}
          </nav>

          <section className="ssoAccount-panel">
            <Suspense fallback={<PanelLoading />}>
              {tab === 'profile' && <ProfilePanel />}
              {tab === 'password' && <PasswordPanel />}
              {tab === 'sessions' && <SessionsPanel />}
              {tab === 'apps-admin' && isAdmin && <AppsAdminPanel />}
              {tab === 'users-admin' && isAdmin && <UsersAdminPanel />}
              {tab === 'org-admin' && isAdmin && <OrgUnitsAdminPanel />}
              {tab === 'roles-admin' && isAdmin && <RolesAdminPanel />}
              {tab === 'sync-admin' && isAdmin && <SyncAdminPanel />}
            </Suspense>
          </section>
        </div>
      </main>
    </div>
  );
}
