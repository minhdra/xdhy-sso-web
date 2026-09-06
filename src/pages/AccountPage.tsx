import { IdcardOutlined, LaptopOutlined, LockOutlined } from '@ant-design/icons';
import { App as AntdApp } from 'antd';
import { useSearchParams } from 'react-router-dom';

import AppHeader from '../components/AppHeader';
import PasswordPanel from './account/PasswordPanel';
import ProfilePanel from './account/ProfilePanel';
import SessionsPanel from './account/SessionsPanel';

const TABS = [
  { key: 'profile', label: 'Thông tin cá nhân', icon: <IdcardOutlined />, color: '#2563a6' },
  { key: 'password', label: 'Mật khẩu', icon: <LockOutlined />, color: '#5b8def' },
  { key: 'sessions', label: 'Phiên đăng nhập', icon: <LaptopOutlined />, color: '#7c6bd6' },
] as const;

export default function AccountPage() {
  const [params, setParams] = useSearchParams();
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
            {tab === 'profile' && <ProfilePanel />}
            {tab === 'password' && <PasswordPanel />}
            {tab === 'sessions' && <SessionsPanel />}
          </section>
        </div>
      </main>
    </div>
  );
}
