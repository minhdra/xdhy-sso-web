import { ArrowRightOutlined } from '@ant-design/icons';
import { App as AntdApp, Empty, Spin, Typography } from 'antd';
import { useEffect, useState } from 'react';

import { getApps, type SsoApp } from '../api';
import AppHeader from '../components/AppHeader';
import { useSessionStore } from '../store/session';

export default function HomePage() {
  const { notification } = AntdApp.useApp();
  const user = useSessionStore((s) => s.user);
  const [apps, setApps] = useState<SsoApp[] | null>(null);

  useEffect(() => {
    getApps()
      .then((res) => setApps(res.ok ? res.data : []))
      .catch(() => {
        notification.error({ message: 'Không tải được danh sách ứng dụng.' });
        setApps([]);
      });
  }, [notification]);

  return (
    <div className="ssoShell ssoHomeShell">
      <AppHeader />
      <main className="ssoHome">
        <Typography.Title level={2} className="ssoHome-title">
          Xin chào{user?.full_name ? `, ${user.full_name}` : ''}
        </Typography.Title>
        <Typography.Text type="secondary" className="ssoHome-sub">
          Chọn một ứng dụng để tiếp tục. Bạn đã đăng nhập một lần và dùng chung cho tất cả.
        </Typography.Text>

        {apps === null ? (
          <div className="ssoHome-loading">
            <Spin size="large" />
          </div>
        ) : apps.length === 0 ? (
          <Empty description="Chưa có ứng dụng nào được cấp quyền" style={{ marginTop: 48 }} />
        ) : (
          <div className="ssoAppGrid">
            {apps.map((app) => (
              <a key={app.key} href={app.url} className="ssoAppCard">
                <span className="ssoAppCard-icon" style={{ background: app.color }}>
                  {(app.name.trim() || app.key).charAt(0).toUpperCase()}
                </span>
                <span className="ssoAppCard-body">
                  <span className="ssoAppCard-name">{app.name || app.key}</span>
                  <span className="ssoAppCard-desc">{app.description}</span>
                  <span className="ssoAppCard-action">Mở ứng dụng <ArrowRightOutlined /></span>
                </span>
              </a>
            ))}
          </div>
        )}
      </main>
      <footer className="ssoFooter">
        <div className="ssoFooter-inner">
          <span>© {new Date().getFullYear()} XDHY · Một tài khoản cho mọi ứng dụng</span>
          <nav aria-label="Liên kết tài khoản">
            <a href="/account">Quản lý tài khoản</a>
            <a href="/account?tab=password">Bảo mật</a>
            <a href="/account?tab=sessions">Thiết bị đăng nhập</a>
          </nav>
        </div>
      </footer>
    </div>
  );
}
