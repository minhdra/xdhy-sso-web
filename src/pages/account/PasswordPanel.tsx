import { LockOutlined } from '@ant-design/icons';
import { App as AntdApp, Button, Form, Input } from 'antd';
import { useState } from 'react';

import { changePasswordRequest } from '../../api';
import { RULES_FORM } from '../../validator';

interface FormValues {
  oldPassword: string;
  newPassword: string;
  confirmPassword: string;
}

export default function PasswordPanel() {
  const { notification } = AntdApp.useApp();
  const [form] = Form.useForm<FormValues>();
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (values: FormValues) => {
    setSaving(true);
    try {
      const res = await changePasswordRequest(values.oldPassword, values.newPassword);
      if (!res.ok) {
        notification.error({ message: res.data.message || 'Không đổi được mật khẩu.' });
        return;
      }
      notification.success({ message: 'Đã đổi mật khẩu.' });
      form.resetFields();
    } catch {
      notification.error({ message: 'Lỗi kết nối tới server.' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="ssoPanel">
      <h2>Đổi mật khẩu</h2>
      <p className="ssoPanel-hint" style={{ marginTop: 0 }}>
        Sau khi đổi, các phiên khác vẫn giữ đăng nhập - thu hồi thủ công ở tab Phiên đăng nhập nếu cần.
      </p>

      <Form form={form} layout="vertical" onFinish={handleSubmit} style={{ maxWidth: 420 }}>
        <Form.Item name="oldPassword" label="Mật khẩu hiện tại" rules={RULES_FORM.required}>
          <Input.Password size="large" autoComplete="current-password" prefix={<LockOutlined />} placeholder="Nhập mật khẩu hiện tại" />
        </Form.Item>
        <Form.Item
          name="newPassword"
          label="Mật khẩu mới"
          rules={[...RULES_FORM.required, ...RULES_FORM.passwordMin]}
        >
          <Input.Password size="large" autoComplete="new-password" prefix={<LockOutlined />} placeholder="Nhập mật khẩu mới" />
        </Form.Item>
        <Form.Item
          name="confirmPassword"
          label="Xác nhận mật khẩu mới"
          dependencies={['newPassword']}
          rules={[
            ...RULES_FORM.required,
            ({ getFieldValue }) => ({
              validator(_, value) {
                if (!value || getFieldValue('newPassword') === value) return Promise.resolve();
                return Promise.reject(new Error('Mật khẩu xác nhận không khớp'));
              },
            }),
          ]}
        >
          <Input.Password size="large" autoComplete="new-password" prefix={<LockOutlined />} placeholder="Nhập lại mật khẩu mới" />
        </Form.Item>
        <Button type="primary" size="large" htmlType="submit" loading={saving}>
          Đổi mật khẩu
        </Button>
      </Form>
    </div>
  );
}
