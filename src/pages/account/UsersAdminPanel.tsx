import {
  DeleteOutlined,
  EditOutlined,
  KeyOutlined,
  LockOutlined,
  PlusOutlined,
  UnlockOutlined,
  UploadOutlined,
} from '@ant-design/icons';
import {
  Alert,
  App as AntdApp,
  Avatar,
  Button,
  Col,
  DatePicker,
  Form,
  Input,
  Modal,
  Popconfirm,
  Row,
  Select,
  Space,
  Table,
  Tag,
  Tooltip,
  Typography,
  Upload,
} from 'antd';
import dayjs, { type Dayjs } from 'dayjs';
import { useCallback, useEffect, useState } from 'react';

import {
  avatarSrc,
  createOrgUser,
  deleteOrgUsers,
  type DropdownItem,
  getOrgRoleDropdown,
  getOrgUnitDropdown,
  getOrgUser,
  lockOrgUser,
  type OrgUserRow,
  resetOrgUserPassword,
  searchOrgUsers,
  updateOrgUser,
  uploadOrgUserAvatar,
} from '../../api';
import { avatarColor } from '../../avatarColor';
import { resizeImage } from '../../imageResize';
import { useSessionStore } from '../../store/session';
import { capitalizeName, maxLen, RULES_FORM } from '../../validator';

interface UserFormValues {
  user_name?: string;
  password?: string;
  full_name: string;
  email: string;
  phone_number?: string;
  gender?: number | null;
  date_of_birth?: Dayjs | null;
  branch_id: number;
  department_id: number;
  position_id: number;
  role_ids?: string[];
  description?: string;
}

const PAGE_SIZE = 20;
// Khớp api-sso orgService DEFAULT_NEW_PASSWORD.
const DEFAULT_PASSWORD = '123456';

// Tên đăng nhập gợi ý từ họ tên: tên + chữ cái đầu họ và tên đệm, bỏ dấu, viết
// thường. "Giang Văn Cốt" -> "cotgv", "Nguyễn Thị Mai Chi" -> "chintm".
export const suggestUserName = (fullName: string): string => {
  const parts = fullName
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
  if (!parts.length) return '';
  const last = parts[parts.length - 1];
  return last + parts.slice(0, -1).map((p) => p[0]).join('');
};

// Quản lý người dùng (chuyển từ build-web "Quản trị hệ thống > Người dùng").
// Thay đổi được api-sso đồng bộ sang tài chính/công việc/chat/meeting.
export default function UsersAdminPanel() {
  const { notification, modal } = AntdApp.useApp();
  const me = useSessionStore((s) => s.user);
  const [form] = Form.useForm<UserFormValues>();
  const [rows, setRows] = useState<OrgUserRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [keyword, setKeyword] = useState('');
  const [branchId, setBranchId] = useState<number | null>(null);
  const [departmentId, setDepartmentId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [editing, setEditing] = useState<string | 'new' | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [saving, setSaving] = useState(false);
  // Ảnh chọn trong form - chỉ tải lên khi bấm Lưu (sau khi tạo/sửa user thành công).
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [formName, setFormName] = useState('');
  // Admin đã tự sửa tên đăng nhập -> thôi tự điền theo họ tên.
  const [userNameTouched, setUserNameTouched] = useState(false);
  const [options, setOptions] = useState<Record<'branches' | 'departments' | 'positions' | 'roles', DropdownItem[]>>({
    branches: [],
    departments: [],
    positions: [],
    roles: [],
  });

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await searchOrgUsers({
        pageIndex: page,
        pageSize: PAGE_SIZE,
        search_content: keyword,
        branch_id: branchId,
        department_id: departmentId,
      });
      if (!res.ok) throw new Error(res.data.message);
      setRows(res.data.data ?? []);
      setTotal(res.data.totalItems ?? 0);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [page, keyword, branchId, departmentId]);
  useEffect(() => void load(), [load]);

  useEffect(() => {
    void (async () => {
      const [b, d, p, r] = await Promise.all([
        getOrgUnitDropdown('branches'),
        getOrgUnitDropdown('departments'),
        getOrgUnitDropdown('positions'),
        getOrgRoleDropdown(),
      ]);
      setOptions({
        branches: b.ok ? b.data : [],
        departments: d.ok ? d.data : [],
        positions: p.ok ? p.data : [],
        roles: r.ok ? r.data : [],
      });
    })();
  }, []);

  const openCreate = () => setEditing('new');

  // Form gắn vào khi modal mở - reset ở đây; sửa thì openEdit đổ giá trị sau
  // khi tải xong chi tiết (lúc đó modal đã mở).
  useEffect(() => {
    if (editing === null) return;
    form.resetFields();
    setAvatarFile(null);
    setAvatarPreview(null);
    setFormName('');
    setUserNameTouched(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing]);

  const pickAvatar = (file: File) => {
    if (!file.type.startsWith('image/')) {
      notification.error({ message: 'Chỉ nhận file ảnh.' });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      notification.error({ message: 'Ảnh tối đa 5MB.' });
      return;
    }
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
  };

  // Cắt vuông 400px + nén WebP giống trang Thông tin cá nhân rồi tải lên.
  const uploadAvatar = async (userId: string): Promise<boolean> => {
    if (!avatarFile) return true;
    const resized = await resizeImage(avatarFile, 400, 'cover', 'image/webp');
    const isWebp = resized.type === 'image/webp';
    const res = await uploadOrgUserAvatar(
      userId,
      new File([resized], isWebp ? 'avatar.webp' : 'avatar.png', { type: resized.type }),
    );
    if (!res.ok) {
      notification.warning({ message: res.data.message || 'Đã lưu người dùng nhưng chưa tải được ảnh đại diện.' });
      return false;
    }
    return true;
  };

  const openEdit = async (userId: string) => {
    setEditing(userId);
    setLoadingDetail(true);
    try {
      const res = await getOrgUser(userId);
      if (!res.ok) throw new Error(res.data.message);
      const u = res.data;
      setAvatarPreview(u.avatar ? avatarSrc(u.avatar) ?? null : null);
      setFormName(u.full_name);
      form.setFieldsValue({
        full_name: u.full_name,
        email: u.email ?? '',
        phone_number: u.phone_number ?? '',
        gender: u.gender,
        date_of_birth: u.date_of_birth ? dayjs(u.date_of_birth) : null,
        branch_id: u.branch_id ?? undefined,
        department_id: u.department_id ?? undefined,
        position_id: u.position_id ?? undefined,
        role_ids: u.role_ids,
        description: u.description ?? '',
      });
    } catch (e) {
      notification.error({ message: e instanceof Error && e.message ? e.message : 'Không tải được người dùng.' });
      setEditing(null);
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleSave = async (values: UserFormValues) => {
    setSaving(true);
    try {
      const payload = {
        ...values,
        full_name: values.full_name.trim(),
        email: values.email.trim(),
        phone_number: values.phone_number?.trim() ?? '',
        date_of_birth: values.date_of_birth ? values.date_of_birth.format('YYYY-MM-DD') : null,
        role_ids: values.role_ids ?? [],
      };
      const res =
        editing === 'new'
          ? await createOrgUser({ ...payload, user_name: values.user_name?.trim() })
          : await updateOrgUser({ ...payload, user_id: editing as string });
      if (!res.ok) {
        notification.error({ message: res.data.message || 'Không lưu được người dùng.' });
        return;
      }
      const userId = editing === 'new' ? (res.data as unknown as { user_id: string }).user_id : (editing as string);
      const avatarOk = await uploadAvatar(userId);
      const defaultPassword =
        editing === 'new' ? (res.data as unknown as { default_password?: string | null }).default_password : null;
      if (avatarOk && defaultPassword) {
        notification.success({
          message: res.data.message || 'Đã thêm người dùng.',
          description: `Tên đăng nhập: ${values.user_name?.trim()} · Mật khẩu ban đầu: ${defaultPassword}`,
          duration: 10,
        });
      } else if (avatarOk) {
        notification.success({ message: res.data.message || 'Đã lưu người dùng.' });
      }
      setEditing(null);
      void load();
    } catch {
      notification.error({ message: 'Không thể kết nối tới máy chủ.' });
    } finally {
      setSaving(false);
    }
  };

  const run = async (fn: () => Promise<{ ok: boolean; data: { message?: string } }>, okMessage: string) => {
    try {
      const res = await fn();
      if (!res.ok) {
        notification.error({ message: res.data.message || 'Thao tác thất bại.' });
        return false;
      }
      notification.success({ message: res.data.message || okMessage });
      void load();
      return true;
    } catch {
      notification.error({ message: 'Không thể kết nối tới máy chủ.' });
      return false;
    }
  };

  const handleResetPassword = (user: OrgUserRow) => {
    modal.confirm({
      title: `Đặt lại mật khẩu cho ${user.full_name}?`,
      content: 'Mật khẩu mới được tạo ngẫu nhiên và gửi tới email của người dùng (nếu có).',
      okText: 'Đặt lại',
      cancelText: 'Huỷ',
      onOk: async () => {
        const res = await resetOrgUserPassword(user.user_id);
        if (!res.ok) {
          notification.error({ message: res.data.message || 'Không đặt lại được mật khẩu.' });
          return;
        }
        modal.success({
          title: 'Đã đặt lại mật khẩu',
          content: (
            <Space direction="vertical">
              <span>
                Mật khẩu mới: <Typography.Text code copyable>{res.data.new_password}</Typography.Text>
              </span>
              <Typography.Text type={res.data.emailed ? 'secondary' : 'warning'}>
                {res.data.emailed ? 'Đã gửi email cho người dùng.' : 'Chưa gửi được email - hãy báo mật khẩu cho người dùng.'}
              </Typography.Text>
            </Space>
          ),
        });
      },
    });
  };

  const isNew = editing === 'new';

  return (
    <div className="ssoPanel ssoAppsAdmin">
      <div className="ssoPanel-headRow">
        <div>
          <h2>Người dùng</h2>
          <p className="ssoPanel-hint">Tài khoản dùng chung cho mọi ứng dụng. Thay đổi được đồng bộ sang các ứng dụng.</p>
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
          Thêm người dùng
        </Button>
      </div>

      <Row gutter={[8, 8]} className="ssoOrg-filters">
        <Col xs={24} md={10}>
          <Input.Search
            allowClear
            placeholder="Tìm theo tên, tài khoản, email"
            onSearch={(v) => {
              setPage(1);
              setKeyword(v.trim());
            }}
          />
        </Col>
        <Col xs={12} md={7}>
          <Select
            allowClear
            showSearch
            optionFilterProp="label"
            placeholder="Chi nhánh"
            style={{ width: '100%' }}
            options={options.branches}
            onChange={(v) => {
              setPage(1);
              setBranchId((v as number) ?? null);
            }}
          />
        </Col>
        <Col xs={12} md={7}>
          <Select
            allowClear
            showSearch
            optionFilterProp="label"
            placeholder="Phòng ban"
            style={{ width: '100%' }}
            options={options.departments}
            onChange={(v) => {
              setPage(1);
              setDepartmentId((v as number) ?? null);
            }}
          />
        </Col>
      </Row>

      {error && (
        <Alert
          className="ssoAppsAdmin-alert"
          type="error"
          showIcon
          message="Không tải được danh sách người dùng"
          action={<Button size="small" onClick={() => void load()}>Thử lại</Button>}
        />
      )}

      <Table<OrgUserRow>
        className="ssoAppsAdmin-table"
        rowKey="user_id"
        size="small"
        loading={loading}
        dataSource={rows}
        scroll={{ x: 640 }}
        pagination={{
          current: page,
          pageSize: PAGE_SIZE,
          total,
          showSizeChanger: false,
          onChange: setPage,
          showTotal: (t) => `${t} người dùng`,
        }}
        columns={[
          {
            title: 'Người dùng',
            key: 'user',
            ellipsis: true,
            render: (_, u) => (
              <Space size={10}>
                <Avatar
                  shape="square"
                  size={32}
                  src={avatarSrc(u.avatar)}
                  style={{ background: avatarColor(u.user_id), color: '#fff', flex: 'none' }}
                >
                  {u.full_name?.trim().charAt(0).toUpperCase()}
                </Avatar>
                <div className="ssoOrg-cell">
                  <span title={u.full_name}>
                    {u.online_flag === 1 && <Tag color="error">Đã khoá</Tag>}
                    {u.full_name}
                  </span>
                  <small>@{u.user_name}</small>
                </div>
              </Space>
            ),
          },
          {
            title: 'Liên hệ',
            key: 'contact',
            width: 190,
            responsive: ['md'],
            render: (_, u) => (
              <div className="ssoOrg-cell" title={u.email ?? undefined}>
                <span>{u.email}</span>
                <small>{u.phone_number}</small>
              </div>
            ),
          },
          {
            title: 'Chức vụ / Phòng ban',
            key: 'org',
            width: 170,
            responsive: ['lg'],
            render: (_, u) => (
              <div className="ssoOrg-cell" title={[u.position_name, u.department_name, u.branch_name].filter(Boolean).join(' · ')}>
                <span>{u.position_name}</span>
                <small>
                  {[u.department_name, u.branch_name].filter(Boolean).join(' · ')}
                </small>
              </div>
            ),
          },
          { title: 'Nhóm quyền', dataIndex: 'role_group', width: 150, responsive: ['xxl'], ellipsis: true },
          {
            title: '',
            key: 'actions',
            width: 150,
            render: (_, u) => {
              const self = u.user_id === me?.user_id;
              return (
                <Space size={0}>
                  <Tooltip title="Sửa">
                    <Button type="text" icon={<EditOutlined />} onClick={() => void openEdit(u.user_id)} />
                  </Tooltip>
                  <Tooltip title="Đặt lại mật khẩu">
                    <Button type="text" icon={<KeyOutlined />} onClick={() => handleResetPassword(u)} />
                  </Tooltip>
                  <Popconfirm
                    title={u.online_flag === 1 ? 'Mở khoá tài khoản?' : 'Khoá tài khoản?'}
                    description={u.online_flag === 1 ? undefined : 'Người dùng bị đăng xuất khỏi mọi thiết bị.'}
                    okText={u.online_flag === 1 ? 'Mở khoá' : 'Khoá'}
                    cancelText="Huỷ"
                    disabled={self}
                    onConfirm={() => run(() => lockOrgUser(u.user_id, u.online_flag === 1 ? 0 : 1), 'Đã cập nhật.')}
                  >
                    <Tooltip title={self ? 'Không thể tự khoá' : u.online_flag === 1 ? 'Mở khoá' : 'Khoá'}>
                      <Button
                        type="text"
                        disabled={self}
                        icon={u.online_flag === 1 ? <UnlockOutlined /> : <LockOutlined />}
                      />
                    </Tooltip>
                  </Popconfirm>
                  <Popconfirm
                    title="Xoá người dùng này?"
                    description="Tài khoản bị vô hiệu hoá ở mọi ứng dụng."
                    okText="Xoá"
                    cancelText="Huỷ"
                    okButtonProps={{ danger: true }}
                    disabled={self}
                    onConfirm={() => run(() => deleteOrgUsers([u.user_id]), 'Đã xoá người dùng.')}
                  >
                    <Tooltip title={self ? 'Không thể tự xoá' : 'Xoá'}>
                      <Button type="text" danger disabled={self} icon={<DeleteOutlined />} />
                    </Tooltip>
                  </Popconfirm>
                </Space>
              );
            },
          },
        ]}
      />

      <Modal
        title={isNew ? 'Thêm người dùng' : 'Sửa người dùng'}
        open={editing !== null}
        onCancel={() => setEditing(null)}
        onOk={() => form.submit()}
        confirmLoading={saving}
        okButtonProps={{ disabled: loadingDetail }}
        okText="Lưu"
        cancelText="Huỷ"
        width={720}
        destroyOnHidden
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSave}
          disabled={loadingDetail}
          onValuesChange={(changed) => {
            if ('full_name' in changed) {
              setFormName(changed.full_name ?? '');
              if (editing === 'new' && !userNameTouched) {
                form.setFieldValue('user_name', suggestUserName(changed.full_name ?? ''));
              }
            }
            if ('user_name' in changed) setUserNameTouched(true);
          }}
        >
          <Space size={16} align="center" className="ssoOrg-avatarRow">
            <Avatar
              size={64}
              src={avatarPreview ?? undefined}
              style={{ background: avatarColor(typeof editing === 'string' ? editing : 'new'), color: '#fff', flex: 'none' }}
            >
              {(formName || '?').trim().charAt(0).toUpperCase()}
            </Avatar>
            <div>
              <Upload
                accept="image/*"
                showUploadList={false}
                beforeUpload={(file) => {
                  pickAvatar(file);
                  return false;
                }}
              >
                <Button icon={<UploadOutlined />}>{avatarPreview ? 'Đổi ảnh đại diện' : 'Chọn ảnh đại diện'}</Button>
              </Upload>
              <div className="ssoPanel-hint">JPG, PNG, GIF, WEBP · tối đa 5MB · lưu khi bấm Lưu</div>
            </div>
          </Space>
          <Row gutter={[16, 4]}>
            <Col xs={24} md={12}>
              <Form.Item
                name="full_name"
                label="Họ tên"
                normalize={capitalizeName}
                validateFirst
                rules={[...RULES_FORM.required, ...RULES_FORM.personName]}
              >
                <Input placeholder="vd: Nguyễn Văn A" />
              </Form.Item>
            </Col>
            {isNew && (
              <>
                <Col xs={24} md={12}>
                  <Form.Item
                    name="user_name"
                    label="Tên đăng nhập"
                    tooltip="Tự điền theo họ tên (vd: Giang Văn Cốt → cotgv). Sửa được nếu trùng."
                    validateFirst
                    rules={[...RULES_FORM.required, ...RULES_FORM.userName]}
                  >
                    <Input autoComplete="off" placeholder="Tự điền khi nhập họ tên" />
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Alert
                    type="info"
                    showIcon
                    style={{ marginTop: 30 }}
                    message={
                      <>
                        Mật khẩu ban đầu: <Typography.Text code>{DEFAULT_PASSWORD}</Typography.Text> — nhắc người dùng đổi sau khi đăng nhập.
                      </>
                    }
                  />
                </Col>
              </>
            )}
            <Col xs={24} md={12}>
              <Form.Item
                name="email"
                label="Email"
                validateFirst
                rules={[...RULES_FORM.required, ...RULES_FORM.email]}
              >
                <Input placeholder="ten@congty.com" />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item
                name="phone_number"
                label="Số điện thoại"
                validateFirst
                rules={[...RULES_FORM.required, ...RULES_FORM.phone]}
              >
                <Input placeholder="vd: 0912345678" />
              </Form.Item>
            </Col>
            <Col xs={12} md={8}>
              <Form.Item name="gender" label="Giới tính">
                <Select
                  allowClear
                  placeholder="Chọn giới tính"
                  options={[
                    { value: 1, label: 'Nam' },
                    { value: 2, label: 'Nữ' },
                    { value: 0, label: 'Khác' },
                  ]}
                />
              </Form.Item>
            </Col>
            <Col xs={12} md={8}>
              <Form.Item name="date_of_birth" label="Ngày sinh" rules={RULES_FORM.birthDate}>
                <DatePicker format="DD/MM/YYYY" placeholder="dd/mm/yyyy" style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item name="branch_id" label="Chi nhánh" rules={RULES_FORM.required}>
                <Select showSearch optionFilterProp="label" placeholder="Chọn chi nhánh" options={options.branches} />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item name="department_id" label="Phòng ban" rules={RULES_FORM.required}>
                <Select showSearch optionFilterProp="label" placeholder="Chọn phòng ban" options={options.departments} />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item name="position_id" label="Chức vụ" rules={RULES_FORM.required}>
                <Select showSearch optionFilterProp="label" placeholder="Chọn chức vụ" options={options.positions} />
              </Form.Item>
            </Col>
            <Col span={24}>
              <Form.Item
                name="role_ids"
                label="Nhóm quyền"
                extra="Tính năng của từng nhóm quyền được gán trong mỗi ứng dụng."
              >
                <Select
                  mode="multiple"
                  allowClear
                  optionFilterProp="label"
                  placeholder="Chọn nhóm quyền"
                  options={options.roles}
                />
              </Form.Item>
            </Col>
            <Col span={24}>
              <Form.Item name="description" label="Ghi chú" validateFirst rules={[...RULES_FORM.text, maxLen(250)]}>
                <Input.TextArea autoSize={{ minRows: 2, maxRows: 4 }} placeholder="Ghi chú thêm (không bắt buộc)" />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>
    </div>
  );
}
