import { LockOutlined } from '@ant-design/icons';
import { App as AntdApp, Button, Form, Input, Result, Typography, theme as antdTheme } from 'antd';
import { useState } from 'react';

import { resetPasswordConfirmRequest } from '../api';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { RULES_FORM } from '../validator';

// Trang "đổi mật khẩu" - user tới đây từ link trong email (?token=...), xem
// AuthService.forgotPassword (api-sso). Không có token thì không cho vào
// form - link phải luôn có token thật, tự gõ URL tay không tính.
export default function ResetPasswordPage() {
  useDocumentTitle('Đặt lại mật khẩu');
  const { token: themeToken } = antdTheme.useToken();
  // notification qua App.useApp() - gọi tĩnh notification.xxx() không ăn
  // theme của ConfigProvider (xem cùng ghi chú ở LoginPage.tsx).
  const { notification } = AntdApp.useApp();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const resetToken = new URLSearchParams(window.location.search).get('token');

  const handleSubmit = async (values: { newPassword: string }) => {
    if (!resetToken) return;
    setLoading(true);
    try {
      const res = await resetPasswordConfirmRequest(resetToken, values.newPassword);
      if (!res.ok) {
        notification.error({ message: res.data.message || 'Không đổi được mật khẩu.' });
        return;
      }
      setDone(true);
    } catch {
      notification.error({ message: 'Lỗi kết nối tới server.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page">
      <div className="card">
        <div className="formSide">
          <div className="formInner">
            {!resetToken ? (
              <Result
                status="error"
                title="Link không hợp lệ"
                subTitle="Thiếu thông tin trong đường link. Vui lòng mở lại link từ email gần nhất, hoặc yêu cầu gửi lại."
                extra={
                  <Button type="primary" href="/login">
                    Về trang đăng nhập
                  </Button>
                }
              />
            ) : done ? (
              <Result
                status="success"
                title="Đổi mật khẩu thành công"
                subTitle="Dùng mật khẩu mới cho lần đăng nhập tiếp theo."
                extra={
                  <Button type="primary" href="/login">
                    Đăng nhập ngay
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
                <Typography.Title level={2} style={{ marginBottom: 4 }}>
                  Đặt mật khẩu mới
                </Typography.Title>
                <Typography.Text type="secondary" style={{ display: 'block', marginBottom: 28 }}>
                  Nhập mật khẩu mới cho tài khoản của bạn.
                </Typography.Text>

                <Form form={form} layout="vertical" onFinish={handleSubmit}>
                  <Form.Item
                    name="newPassword"
                    label="Mật khẩu mới"
                    rules={[...RULES_FORM.required, ...RULES_FORM.passwordMin]}
                  >
                    <Input.Password
                      size="large"
                      placeholder="Ít nhất 6 ký tự"
                      autoComplete="new-password"
                      prefix={<LockOutlined style={{ color: themeToken.colorPrimary }} />}
                    />
                  </Form.Item>
                  <Form.Item
                    name="confirmPassword"
                    label="Xác nhận mật khẩu mới"
                    dependencies={['newPassword']}
                    rules={[
                      ...RULES_FORM.required,
                      ({ getFieldValue }) => ({
                        validator(_, value) {
                          if (!value || getFieldValue('newPassword') === value) {
                            return Promise.resolve();
                          }
                          return Promise.reject(new Error('Mật khẩu xác nhận không khớp'));
                        },
                      }),
                    ]}
                  >
                    <Input.Password
                      size="large"
                      placeholder="Nhập lại mật khẩu mới"
                      autoComplete="new-password"
                      prefix={<LockOutlined style={{ color: themeToken.colorPrimary }} />}
                    />
                  </Form.Item>
                  <Button
                    type="primary"
                    size="large"
                    block
                    htmlType="submit"
                    loading={loading}
                    style={{ fontWeight: 600 }}
                  >
                    Đổi mật khẩu
                  </Button>
                </Form>
              </>
            )}
            <Typography.Text type="secondary" className="footer">
              © An Trường Phát Hưng Yên. All rights reserved.
            </Typography.Text>
          </div>
        </div>
        <div className="illustrationSide">
          <div className="illustrationCopy">
            <h2>Bảo mật tài khoản của bạn</h2>
            <p>Chọn mật khẩu mới đủ mạnh và không dùng lại ở nơi khác.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
