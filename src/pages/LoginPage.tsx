import { CheckOutlined, LockOutlined, UserOutlined } from '@ant-design/icons';
import {
  App as AntdApp,
  Button,
  Checkbox,
  Flex,
  Form,
  Input,
  Result,
  Typography,
  theme as antdTheme,
} from 'antd';
import lottie from 'lottie-web/build/player/lottie_light';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import loginBadge from '../assets/login-badge.json';
import { forgotPasswordRequest, getMe, loginRequest, refreshRequest } from '../api';
import { PageLoading } from '../components/PageLoading';
import { RULES_FORM } from '../validator';

const BRAND_NAME = 'XDHY';

// Chặn open-redirect: chỉ theo `redirect` nếu là path nội bộ HOẶC origin nằm
// trong domain cha được phép (build lúc dựng image).
const ALLOWED_REDIRECT_SUFFIX = import.meta.env.VITE_ALLOWED_REDIRECT_SUFFIX ?? '';

function safeRedirectTarget(raw: string | null): string | null {
  if (!raw) return null;
  if (raw.startsWith('/')) return raw;
  if (!ALLOWED_REDIRECT_SUFFIX) return null;
  try {
    const url = new URL(raw);
    // https luôn OK. http chỉ chấp nhận khi hostname là localhost/127.0.0.1
    // hoặc IPv4 literal (deploy trên server IP tĩnh, chưa gắn domain + TLS) -
    // với domain thật vẫn bắt buộc https để chống downgrade.
    const isIpv4 = /^(\d{1,3}\.){3}\d{1,3}$/.test(url.hostname);
    const httpOk =
      url.protocol === 'http:' &&
      (url.hostname === 'localhost' || url.hostname === '127.0.0.1' || isIpv4);
    if ((url.protocol === 'https:' || httpOk) && url.hostname.endsWith(ALLOWED_REDIRECT_SUFFIX)) {
      return raw;
    }
  } catch {
    // raw không parse được thành URL hợp lệ -> bỏ qua
  }
  return null;
}

type ViewMode = 'login' | 'forgot' | 'forgotSent';

export default function LoginPage() {
  const navigate = useNavigate();
  const { token } = antdTheme.useToken();
  // notification qua App.useApp() (không phải gọi tĩnh `notification.xxx()`)
  // - static call KHÔNG ăn theme của ConfigProvider, luôn ra light dù đang
  // dark mode (bug thật đã gặp, xem main.tsx).
  const { notification } = AntdApp.useApp();
  const [view, setView] = useState<ViewMode>('login');
  const [loginForm] = Form.useForm();
  const [forgotForm] = Form.useForm();
  const [loginLoading, setLoginLoading] = useState(false);
  const [forgotLoading, setForgotLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const sessionCheckStarted = useRef(false);

  const redirectTo = useMemo(
    () => safeRedirectTarget(new URLSearchParams(window.location.search).get('redirect')),
    [],
  );

  useEffect(() => {
    if (sessionCheckStarted.current) return;
    sessionCheckStarted.current = true;

    const continueToApp = () => {
      if (!redirectTo) {
        navigate('/', { replace: true });
      } else if (redirectTo.startsWith('/')) {
        navigate(redirectTo, { replace: true });
      } else {
        window.location.replace(redirectTo);
      }
    };

    const checkSession = async () => {
      try {
        const me = await getMe();
        if (me.ok) {
          continueToApp();
          return;
        }

        // Access token có thể vừa hết hạn nhưng refresh token vẫn hợp lệ.
        // Cấp lại access token rồi kiểm tra lần cuối trước khi hiện form.
        if (me.status === 401 || me.status === 403) {
          const refreshed = await refreshRequest();
          if (refreshed.ok && (await getMe()).ok) {
            continueToApp();
            return;
          }
        }
      } catch {
        // Lỗi mạng hoặc không có phiên: vẫn cho phép người dùng đăng nhập tay.
      }
      setCheckingSession(false);
    };

    void checkSession();
  }, [navigate, redirectTo]);

  const illustrationRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (checkingSession) return;
    if (!illustrationRef.current) return;
    const anim = lottie.loadAnimation({
      container: illustrationRef.current,
      renderer: 'svg',
      loop: true,
      autoplay: true,
      animationData: loginBadge,
    });
    anim.setSpeed(0.5);
    return () => anim.destroy();
  }, [checkingSession]);

  const handleLogin = async (values: { username: string; password: string; remember?: boolean }) => {
    setLoginLoading(true);
    try {
      const remember = values.remember === true;
      const res = await loginRequest({ username: values.username, password: values.password, remember });
      if (!res.ok) {
        notification.error({ message: res.data.message || 'Đăng nhập thất bại.' });
        return;
      }
      // Icon badge tròn + progress bar mảnh khớp nhịp 600ms trước khi điều
      // hướng - copy đúng animation từ build-web (Login.tsx + login.module.scss).
      notification.success({
        key: 'login-success',
        className: 'success-notice',
        icon: (
          <span className="success-icon">
            <CheckOutlined />
          </span>
        ),
        message: 'Đăng nhập thành công',
        description: (
          <>
            <p className="success-subtitle">Đang chuyển hướng vào hệ thống…</p>
            <div className="success-bar">
              <div className="success-bar-fill" />
            </div>
          </>
        ),
        duration: 0.6,
      });
      // Có redirect (thường là URL build-web cross-origin) -> nav cứng.
      // Không có -> vào trang chủ SSO (danh sách app).
      setTimeout(() => {
        if (redirectTo) window.location.href = redirectTo;
        else navigate('/', { replace: true });
      }, 400);
    } catch {
      notification.error({ message: 'Lỗi kết nối tới server.' });
    } finally {
      setLoginLoading(false);
    }
  };

  const handleForgot = async (values: { email: string }) => {
    setForgotLoading(true);
    try {
      const res = await forgotPasswordRequest(values.email);
      if (!res.ok) {
        notification.error({ message: res.data.message || 'Không gửi được yêu cầu.' });
        return;
      }
      setView('forgotSent');
    } catch {
      notification.error({ message: 'Lỗi kết nối tới server.' });
    } finally {
      setForgotLoading(false);
    }
  };

  if (checkingSession) {
    return <PageLoading />;
  }

  return (
    <div className="page">
      <div className="card">
        <div className="formSide">
          <div className="formInner">
            {view === 'forgotSent' ? (
              <Result
                status="success"
                title="Đã gửi email"
                subTitle="Nếu email tồn tại trong hệ thống, một link đặt lại mật khẩu đã được gửi tới. Link có hiệu lực trong 1 giờ."
                extra={
                  <Button type="primary" onClick={() => setView('login')}>
                    Về trang đăng nhập
                  </Button>
                }
              />
            ) : (
              <>
                <img
                  className="logo"
                  src="/logo.png"
                  alt="Logo"
                  onError={(e) => (e.currentTarget.style.display = 'none')}
                />

                {view === 'login' ? (
                  <>
                    <Typography.Title level={2} style={{ marginBottom: 4 }}>
                      Chào mừng trở lại!
                    </Typography.Title>
                    <Typography.Text type="secondary" style={{ display: 'block', marginBottom: 28 }}>
                      Đăng nhập để tiếp tục công việc của bạn.
                    </Typography.Text>

                    <Form form={loginForm} layout="vertical" onFinish={handleLogin}>
                      <Form.Item name="username" label="Tài khoản / Email / Điện thoại" rules={RULES_FORM.required}>
                        <Input
                          size="large"
                          placeholder="Tài khoản, email hoặc số điện thoại"
                          allowClear
                          autoComplete="username"
                          prefix={<UserOutlined style={{ color: token.colorPrimary }} />}
                        />
                      </Form.Item>
                      <Form.Item name="password" label="Mật khẩu" rules={RULES_FORM.required}>
                        <Input.Password
                          size="large"
                          placeholder="Mật khẩu"
                          allowClear
                          autoComplete="current-password"
                          prefix={<LockOutlined style={{ color: token.colorPrimary }} />}
                        />
                      </Form.Item>
                      <Flex align="center" justify="space-between" style={{ marginBottom: 20 }}>
                        <Form.Item name="remember" valuePropName="checked" noStyle initialValue={true}>
                          <Checkbox>Ghi nhớ đăng nhập</Checkbox>
                        </Form.Item>
                        <Typography.Link onClick={() => setView('forgot')}>Quên mật khẩu?</Typography.Link>
                      </Flex>
                      <Button
                        type="primary"
                        size="large"
                        block
                        htmlType="submit"
                        loading={loginLoading}
                        style={{ fontWeight: 600 }}
                      >
                        Đăng nhập
                      </Button>
                    </Form>
                  </>
                ) : (
                  <>
                    <Typography.Title level={2} style={{ marginBottom: 4 }}>
                      Quên mật khẩu
                    </Typography.Title>
                    <Typography.Text type="secondary" style={{ display: 'block', marginBottom: 28 }}>
                      Nhập email đã đăng ký, chúng tôi sẽ gửi link đặt lại mật khẩu.
                    </Typography.Text>

                    <Form form={forgotForm} layout="vertical" onFinish={handleForgot}>
                      <Form.Item
                        name="email"
                        label="Email"
                        rules={[...RULES_FORM.required, ...RULES_FORM.email]}
                      >
                        <Input
                          size="large"
                          placeholder="Nhập email của bạn"
                          allowClear
                          autoComplete="email"
                          prefix={<UserOutlined style={{ color: token.colorPrimary }} />}
                        />
                      </Form.Item>
                      <Typography.Link
                        onClick={() => setView('login')}
                        style={{ display: 'block', marginBottom: 20, textAlign: 'right' }}
                      >
                        Đã nhớ ra mật khẩu? Đăng nhập ngay
                      </Typography.Link>
                      <Button
                        type="primary"
                        size="large"
                        block
                        htmlType="submit"
                        loading={forgotLoading}
                        style={{ fontWeight: 600 }}
                      >
                        Đặt lại mật khẩu
                      </Button>
                    </Form>
                  </>
                )}
              </>
            )}
            <Typography.Text type="secondary" className="footer">
              © An Trường Phát Hưng Yên. All rights reserved.
            </Typography.Text>
          </div>
        </div>
        <div className="illustrationSide">
          <div className="illustrationCopy">
            <h2>
              Cổng truy cập chung của
              <br />
              doanh nghiệp
            </h2>
            <p>Đăng nhập một lần để sử dụng các ứng dụng nội bộ được kết nối trong {BRAND_NAME}.</p>
          </div>
          <div ref={illustrationRef} className="illustrationAnim" />
        </div>
      </div>
    </div>
  );
}
