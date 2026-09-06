import {
  LogoutOutlined,
  MoonOutlined,
  SettingOutlined,
  SunOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { Avatar, Dropdown, Switch, Tooltip } from 'antd';
import { useNavigate } from 'react-router-dom';

import { avatarSrc, logoutRequest } from '../api';
import { useSessionStore } from '../store/session';
import { useThemeStore } from '../store/theme';

const BRAND_NAME = 'XDHY';

export default function AppHeader() {
  const navigate = useNavigate();
  const user = useSessionStore((s) => s.user);
  const clear = useSessionStore((s) => s.clear);
  const mode = useThemeStore((s) => s.mode);
  const toggleTheme = useThemeStore((s) => s.toggle);

  const handleLogout = async () => {
    try {
      await logoutRequest();
    } catch {
      // Kể cả lỗi mạng vẫn xoá state phía client + về trang đăng nhập.
    }
    clear();
    window.location.href = '/login';
  };

  const items = [
    {
      key: 'account',
      icon: <SettingOutlined />,
      label: 'Quản lý tài khoản',
      onClick: () => navigate('/account'),
    },
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: 'Đăng xuất',
      danger: true,
      onClick: () => {
        void handleLogout();
      },
    },
  ];

  return (
    <header className='ssoHeader'>
      <div className='ssoHeader-inner'>
        <button
          className='ssoHeader-brand'
          onClick={() => navigate('/')}
          type='button'
        >
          <img
            src='/logo.png'
            alt={BRAND_NAME}
            onError={(e) => (e.currentTarget.style.display = 'none')}
          />
        </button>

        <div className='ssoHeader-right'>
          <Tooltip title={mode === 'dark' ? 'Chế độ sáng' : 'Chế độ tối'}>
            <Switch
              checked={mode === 'dark'}
              onChange={toggleTheme}
              checkedChildren={<MoonOutlined />}
              unCheckedChildren={<SunOutlined />}
            />
          </Tooltip>

          <Dropdown
            menu={{ items }}
            trigger={['click']}
            placement='bottomRight'
          >
            <button className='ssoHeader-user' type='button'>
              <Avatar
                size={34}
                src={avatarSrc(user?.avatar)}
                icon={<UserOutlined />}
                style={{ backgroundColor: '#2563a6', flex: 'none' }}
              >
                {user?.full_name?.trim()?.charAt(0)?.toUpperCase()}
              </Avatar>
              <span className='ssoHeader-userText'>
                <span className='ssoHeader-userName'>{user?.full_name}</span>
                {user?.position_name && (
                  <span className='ssoHeader-userRole'>
                    {user.position_name}
                  </span>
                )}
              </span>
            </button>
          </Dropdown>
        </div>
      </div>
    </header>
  );
}
