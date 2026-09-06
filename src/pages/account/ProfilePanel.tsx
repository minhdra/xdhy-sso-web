import { UploadOutlined, UserOutlined } from '@ant-design/icons';
import {
  App as AntdApp,
  Avatar,
  Button,
  DatePicker,
  Form,
  Input,
  Select,
  Upload,
} from 'antd';
import dayjs from 'dayjs';
import { useEffect, useState } from 'react';

import {
  avatarSrc,
  getProfile,
  updateProfileRequest,
  uploadAvatarRequest,
  type AccountProfile,
} from '../../api';
import { useSessionStore } from '../../store/session';
import { RULES_FORM } from '../../validator';

interface FormValues {
  full_name: string;
  email: string;
  phone_number?: string;
  gender?: number;
  date_of_birth?: dayjs.Dayjs | null;
}

function InfoRow({
  label,
  value,
}: {
  label: string;
  value: string | null | undefined;
}) {
  return (
    <div className='ssoInfoRow'>
      <span className='ssoInfoRow-label'>{label}</span>
      <span className='ssoInfoRow-value'>{value || '—'}</span>
    </div>
  );
}

export default function ProfilePanel() {
  const { notification } = AntdApp.useApp();
  const [form] = Form.useForm<FormValues>();
  const setUser = useSessionStore((s) => s.setUser);
  const storeUser = useSessionStore((s) => s.user);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [profile, setProfile] = useState<AccountProfile | null>(null);

  useEffect(() => {
    getProfile()
      .then((res) => {
        if (!res.ok) {
          notification.error({
            message: res.data.message || 'Không tải được hồ sơ.',
          });
          return;
        }
        const p = res.data as AccountProfile;
        setProfile(p);
        form.setFieldsValue({
          full_name: p.full_name,
          email: p.email ?? '',
          phone_number: p.phone_number ?? '',
          gender: p.gender ?? undefined,
          date_of_birth: p.date_of_birth ? dayjs(p.date_of_birth) : null,
        });
      })
      .catch(() => notification.error({ message: 'Lỗi kết nối tới server.' }))
      .finally(() => setLoading(false));
  }, [form, notification]);

  const handleSave = async (values: FormValues) => {
    setSaving(true);
    try {
      const res = await updateProfileRequest({
        full_name: values.full_name,
        email: values.email,
        phone_number: values.phone_number ?? '',
        gender: values.gender ?? null,
        date_of_birth: values.date_of_birth
          ? values.date_of_birth.format('YYYY-MM-DD')
          : null,
      });
      if (!res.ok) {
        notification.error({
          message: res.data.message || 'Không lưu được thông tin.',
        });
        return;
      }
      notification.success({ message: 'Đã cập nhật thông tin.' });
      setProfile((prev) =>
        prev ? { ...prev, full_name: values.full_name } : prev,
      );
      if (storeUser) setUser({ ...storeUser, full_name: values.full_name });
    } catch {
      notification.error({ message: 'Lỗi kết nối tới server.' });
    } finally {
      setSaving(false);
    }
  };

  const handleUpload = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      notification.error({ message: 'Chỉ nhận file ảnh.' });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      notification.error({ message: 'Ảnh tối đa 5MB.' });
      return;
    }
    setUploading(true);
    try {
      const res = await uploadAvatarRequest(file);
      if (!res.ok) {
        notification.error({
          message: res.data.message || 'Tải ảnh thất bại.',
        });
        return;
      }
      setProfile((prev) =>
        prev ? { ...prev, avatar: res.data.avatar } : prev,
      );
      if (storeUser) setUser({ ...storeUser, avatar: res.data.avatar });
      notification.success({ message: 'Đã cập nhật ảnh đại diện.' });
    } catch {
      notification.error({ message: 'Lỗi kết nối tới server.' });
    } finally {
      setUploading(false);
    }
  };

  const fullName = profile?.full_name ?? '';

  return (
    <div className='ssoPanel'>
      <h2>Thông tin cá nhân</h2>

      <div className='ssoProfile-summary'>
        <div className='ssoPanel-avatar'>
          <Avatar
            size={76}
            src={avatarSrc(profile?.avatar)}
            icon={<UserOutlined />}
            style={{ background: '#2563a6', flex: 'none' }}
          >
            {fullName.trim().charAt(0).toUpperCase()}
          </Avatar>
          <div>
            <Upload
              accept='image/*'
              showUploadList={false}
              beforeUpload={(file) => {
                void handleUpload(file);
                return false;
              }}
            >
              <Button icon={<UploadOutlined />} loading={uploading}>
                Đổi ảnh đại diện
              </Button>
            </Upload>
            <p className='ssoPanel-hint'>JPG, PNG, GIF, WEBP · tối đa 5MB</p>
          </div>
        </div>
        <div className='ssoProfile-other'>
          <h3 className='ssoPanel-subhead'>Thông tin khác</h3>
          <div className='ssoInfoList'>
            <InfoRow label='Tài khoản' value={`@${profile?.user_name}`} />
            <InfoRow label='Chức vụ' value={profile?.position_name} />
            <InfoRow label='Phòng ban' value={profile?.department_name} />
            <InfoRow label='Chi nhánh' value={profile?.branch_name} />
          </div>
        </div>
      </div>

      <h3 className='ssoPanel-subhead'>Thông tin cơ bản</h3>
      <Form
        form={form}
        layout='vertical'
        onFinish={handleSave}
        disabled={loading}
        requiredMark={false}
        className='ssoPanel-form'
      >
        <Form.Item
          name='full_name'
          label='Họ và tên'
          rules={RULES_FORM.required}
        >
          <Input size='large' placeholder='Nhập họ và tên' />
        </Form.Item>
        <Form.Item
          name='email'
          label='Email'
          rules={[...RULES_FORM.required, ...RULES_FORM.email]}
        >
          <Input size='large' placeholder='ten@congty.com' />
        </Form.Item>
        <Form.Item
          name='phone_number'
          label='Số điện thoại'
          rules={RULES_FORM.phone}
        >
          <Input size='large' placeholder='Nhập số điện thoại' />
        </Form.Item>
        <Form.Item name='gender' label='Giới tính'>
          <Select
            size='large'
            allowClear
            placeholder='Chọn giới tính'
            options={[
              { value: 1, label: 'Nam' },
              { value: 2, label: 'Nữ' },
              { value: 0, label: 'Khác' },
            ]}
          />
        </Form.Item>
        <Form.Item name='date_of_birth' label='Ngày sinh'>
          <DatePicker
            size='large'
            format='DD/MM/YYYY'
            placeholder='Chọn ngày sinh'
            style={{ width: '100%' }}
          />
        </Form.Item>
        <Form.Item
          label={<span aria-hidden='true'>&nbsp;</span>}
          className='ssoPanel-submit'
        >
          <Button
            type='primary'
            size='large'
            htmlType='submit'
            loading={saving}
            style={{ borderRadius: 'var(--radius-md)' }}
          >
            Lưu thay đổi
          </Button>
        </Form.Item>
      </Form>
    </div>
  );
}
