import { ArrowRightOutlined, ReloadOutlined } from '@ant-design/icons';
import { Alert, Button, Empty, Skeleton, Tag, Typography } from 'antd';
import { useCallback, useEffect, useState } from 'react';

import { avatarSrc, getApps, type SsoApp } from '../api';
import AppHeader from '../components/AppHeader';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { useSessionStore } from '../store/session';

export default function HomePage() {
  useDocumentTitle('Ứng dụng nội bộ');
  const user = useSessionStore((s) => s.user);
  const [apps, setApps] = useState<SsoApp[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const loadApps = useCallback(async (preserveData = false) => {
    setLoadError(false);
    if (preserveData) setRefreshing(true);
    else setApps(null);
    try {
      const res = await getApps();
      if (!res.ok) throw new Error(res.data.message);
      setApps(res.data);
    } catch {
      setLoadError(true);
      setApps((current) => current ?? []);
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => void loadApps(), [loadApps]);

  return (
    <div className='ssoShell ssoHomeShell'>
      <AppHeader />
      <main className='ssoHome'>
        <Typography.Title level={2} className='ssoHome-title'>
          Xin chào{user?.full_name ? `, ${user.full_name}` : ''}
        </Typography.Title>
        <Typography.Text type='secondary' className='ssoHome-sub'>
          Chọn một ứng dụng để tiếp tục. Bạn đã đăng nhập một lần và dùng chung
          cho tất cả.
        </Typography.Text>

        {loadError && (
          <Alert
            className='ssoHome-alert'
            type='error'
            showIcon
            message='Chưa thể tải danh sách ứng dụng'
            description='Phiên đăng nhập vẫn được giữ. Bạn có thể thử kết nối lại mà không cần đăng nhập lại.'
            action={
              <Button
                icon={<ReloadOutlined />}
                loading={refreshing}
                onClick={() => void loadApps(true)}
              >
                Thử lại
              </Button>
            }
          />
        )}

        {apps === null ? (
          <div className='ssoAppGrid' aria-label='Đang tải danh sách ứng dụng'>
            {Array.from({ length: 4 }, (_, index) => (
              <div className='ssoAppCard ssoAppCard-skeleton' key={index}>
                <Skeleton.Avatar active shape='square' size={46} />
                <Skeleton
                  active
                  title={{ width: '48%' }}
                  paragraph={{ rows: 2 }}
                />
              </div>
            ))}
          </div>
        ) : apps.length === 0 && !loadError ? (
          <Empty
            description='Chưa có ứng dụng nào được cấp quyền'
            style={{ marginTop: 48 }}
          />
        ) : (
          <div className={`ssoAppGrid${refreshing ? ' is-refreshing' : ''}`}>
            {apps.map((app) => (
              <a
                key={app.app_id}
                href={app.url || undefined}
                className={`ssoAppCard${app.url ? '' : ' is-unavailable'}`}
                aria-disabled={!app.url}
                onClick={(event) => {
                  if (!app.url) event.preventDefault();
                }}
              >
                <span
                  className='ssoAppCard-icon'
                  style={{ background: app.icon ? 'transparent' : app.color }}
                >
                  {app.icon ? <img src={avatarSrc(app.icon)} alt="" width={46} height={46} /> : (app.app_name.trim() || app.app_key).charAt(0).toUpperCase()}
                </span>
                <span className='ssoAppCard-body'>
                  <span className='ssoAppCard-name'>
                    {app.app_name || app.app_key}
                  </span>
                  <span className='ssoAppCard-desc'>{app.description}</span>
                  <span className='ssoAppCard-action'>
                    {app.url ? (
                      <>
                        Mở ứng dụng <ArrowRightOutlined />
                      </>
                    ) : (
                      <Tag>Chưa cấu hình URL</Tag>
                    )}
                  </span>
                </span>
              </a>
            ))}
          </div>
        )}
      </main>
      <footer className='ssoFooter'>
        <div className='ssoFooter-inner'>
          <span>
            © {new Date().getFullYear()} XDHY · Một tài khoản cho mọi ứng dụng
          </span>
          <nav aria-label='Liên kết tài khoản'>
            <a href='/account'>Quản lý tài khoản</a>
            <a href='/account?tab=password'>Bảo mật</a>
            <a href='/account?tab=sessions'>Thiết bị đăng nhập</a>
          </nav>
        </div>
      </footer>
    </div>
  );
}
