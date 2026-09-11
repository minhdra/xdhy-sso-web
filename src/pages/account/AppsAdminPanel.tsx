import { DeleteOutlined, EditOutlined, PlusOutlined, TeamOutlined } from '@ant-design/icons';
import {
  App as AntdApp,
  Avatar,
  Button,
  Checkbox,
  Form,
  Input,
  InputNumber,
  Modal,
  Pagination,
  Popconfirm,
  Space,
  Table,
  Tag,
  Typography,
} from 'antd';
import { useEffect, useState } from 'react';

import {
  avatarSrc,
  getAdminApps,
  getAdminUsers,
  getAppAccessRequest,
  upsertAppRequest,
  deleteAppRequest,
  setAppAccessRequest,
  type AdminApp,
  type AdminUser,
} from '../../api';
import { RULES_FORM } from '../../validator';

interface AppFormValues {
  app_id?: string | null;
  app_key: string;
  app_name: string;
  description?: string;
  url?: string;
  color?: string;
  sort_order?: number;
}

// Bảng "Phân quyền truy cập" gồm 2 loại hàng trộn chung 1 danh sách - hàng
// "chức vụ" (thanh tiêu đề nhóm, nền nhạt) + hàng "người" (checkbox chọn) -
// giống cách task-web trình bày bảng thành viên công trình
// (task-web/src/modules/task/construction-project-permission/components/ProjectMemberTable.tsx),
// chỉ khác là quyền ở đây chỉ có 2 trạng thái (có/không), không phải nhiều
// cấp độ - nên dùng checkbox thay vì dropdown "Quyền".
type AccessRow =
  | { kind: 'position'; key: string; position_name: string }
  | { kind: 'user'; key: string; user: AdminUser };

const UNASSIGNED_POSITION = 'Chưa gán chức vụ';
const ACCESS_PAGE_SIZE = 20;

const sortByPositionThenName = (users: AdminUser[]): AdminUser[] =>
  [...users].sort((a, b) => {
    const posA = a.position_name || UNASSIGNED_POSITION;
    const posB = b.position_name || UNASSIGNED_POSITION;
    return posA !== posB
      ? posA.localeCompare(posB, 'vi')
      : a.full_name.localeCompare(b.full_name, 'vi');
  });

// Chỉ nhận danh sách của ĐÚNG 1 TRANG (đã cắt theo phân trang) - chèn 1 hàng
// "chức vụ" mỗi khi chức vụ đổi so với người liền trước. Nếu 1 nhóm bị cắt
// ngang bởi ranh giới trang, trang sau lặp lại đúng thanh tiêu đề đó (chấp
// nhận được - tránh phải đồng bộ trạng thái cuộn phức tạp hơn).
const buildAccessRows = (pageUsers: AdminUser[]): AccessRow[] => {
  const rows: AccessRow[] = [];
  let lastPosition: string | null = null;
  for (const u of pageUsers) {
    const pos = u.position_name || UNASSIGNED_POSITION;
    if (pos !== lastPosition) {
      rows.push({ kind: 'position', key: `pos-${pos}-${u.user_id}`, position_name: pos });
      lastPosition = pos;
    }
    rows.push({ kind: 'user', key: u.user_id, user: u });
  }
  return rows;
};

// Màu nền FALLBACK khi không có ảnh avatar thật (antd Avatar chỉ hiện
// background này lúc `src` rỗng/tải lỗi - ảnh thật luôn nằm đè lên trên).
// Deterministic theo user_id (không lưu DB), không mang ý nghĩa gì, chỉ để
// phân biệt trực quan giữa các người trong danh sách dài.
const avatarColor = (id: string): string => {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return `hsl(${hash % 360}, 55%, 45%)`;
};

export default function AppsAdminPanel() {
  const { notification } = AntdApp.useApp();
  const [apps, setApps] = useState<AdminApp[] | null>(null);
  const [users, setUsers] = useState<AdminUser[] | null>(null);

  const [appModalOpen, setAppModalOpen] = useState(false);
  const [appForm] = Form.useForm<AppFormValues>();
  const [savingApp, setSavingApp] = useState(false);

  const [accessApp, setAccessApp] = useState<AdminApp | null>(null);
  const [accessUserIds, setAccessUserIds] = useState<string[]>([]);
  const [accessSearch, setAccessSearch] = useState('');
  const [accessPage, setAccessPage] = useState(1);
  const [savingAccess, setSavingAccess] = useState(false);

  const loadApps = () => {
    getAdminApps()
      .then((res) => setApps(res.ok ? res.data : []))
      .catch(() => {
        notification.error({ message: 'Không tải được danh sách ứng dụng.' });
        setApps([]);
      });
  };

  useEffect(() => {
    loadApps();
    getAdminUsers()
      .then((res) => setUsers(res.ok ? res.data : []))
      .catch(() => setUsers([]));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const openCreate = () => {
    appForm.resetFields();
    appForm.setFieldsValue({ color: '#2563a6', sort_order: (apps?.length ?? 0) + 1 });
    setAppModalOpen(true);
  };

  const openEdit = (app: AdminApp) => {
    appForm.setFieldsValue({
      app_id: app.app_id,
      app_key: app.app_key,
      app_name: app.app_name,
      description: app.description ?? '',
      url: app.url,
      color: app.color,
      sort_order: app.sort_order,
    });
    setAppModalOpen(true);
  };

  const handleSaveApp = async (values: AppFormValues) => {
    setSavingApp(true);
    try {
      const res = await upsertAppRequest(values);
      if (!res.ok) {
        notification.error({ message: res.data.message || 'Không lưu được ứng dụng.' });
        return;
      }
      notification.success({ message: 'Đã lưu ứng dụng.' });
      setAppModalOpen(false);
      loadApps();
    } catch {
      notification.error({ message: 'Lỗi kết nối tới server.' });
    } finally {
      setSavingApp(false);
    }
  };

  const handleDelete = async (app: AdminApp) => {
    try {
      const res = await deleteAppRequest(app.app_id);
      if (!res.ok) {
        notification.error({ message: res.data.message || 'Không xoá được.' });
        return;
      }
      notification.success({ message: 'Đã xoá ứng dụng.' });
      loadApps();
    } catch {
      notification.error({ message: 'Lỗi kết nối tới server.' });
    }
  };

  const openAccess = async (app: AdminApp) => {
    setAccessApp(app);
    setAccessUserIds([]);
    setAccessSearch('');
    setAccessPage(1);
    try {
      const res = await getAppAccessRequest(app.app_id);
      if (res.ok) setAccessUserIds(res.data.map((u) => u.user_id));
    } catch {
      notification.error({ message: 'Không tải được danh sách người được cấp quyền.' });
    }
  };

  const handleSaveAccess = async () => {
    if (!accessApp) return;
    setSavingAccess(true);
    try {
      const res = await setAppAccessRequest(accessApp.app_id, accessUserIds);
      if (!res.ok) {
        notification.error({ message: res.data.message || 'Không lưu được.' });
        return;
      }
      notification.success({ message: `Đã cập nhật quyền truy cập "${accessApp.app_name}".` });
      setAccessApp(null);
      loadApps();
    } catch {
      notification.error({ message: 'Lỗi kết nối tới server.' });
    } finally {
      setSavingAccess(false);
    }
  };

  const toggleAccessUser = (userId: string, checked: boolean) => {
    setAccessUserIds((prev) =>
      checked ? [...prev, userId] : prev.filter((id) => id !== userId),
    );
  };

  const toggleAccessGroup = (userIds: string[], checked: boolean) => {
    setAccessUserIds((prev) => {
      const set = new Set(prev);
      userIds.forEach((id) => (checked ? set.add(id) : set.delete(id)));
      return Array.from(set);
    });
  };

  const accessSearchLower = accessSearch.trim().toLowerCase();
  // Sort + lọc trên TOÀN BỘ danh sách trước, rồi mới cắt trang - đếm/chọn cả
  // nhóm (toggleAccessGroup) phải dựa trên đúng thành viên thật của chức vụ
  // đó, không chỉ những người đang hiện ở trang hiện tại.
  const filteredAccessUsers = sortByPositionThenName(
    (users ?? []).filter(
      (u) =>
        !accessSearchLower ||
        u.full_name.toLowerCase().includes(accessSearchLower) ||
        u.user_name.toLowerCase().includes(accessSearchLower),
    ),
  );
  const accessTotal = filteredAccessUsers.length;
  const accessPageUsers = filteredAccessUsers.slice(
    (accessPage - 1) * ACCESS_PAGE_SIZE,
    accessPage * ACCESS_PAGE_SIZE,
  );
  const accessRows = buildAccessRows(accessPageUsers);
  const membersOfPosition = (pos: string) =>
    filteredAccessUsers
      .filter((u) => (u.position_name || UNASSIGNED_POSITION) === pos)
      .map((u) => u.user_id);

  return (
    <div className="ssoPanel">
      <div className="ssoPanel-headRow">
        <div>
          <h2 style={{ marginBottom: 4 }}>Quản lý ứng dụng</h2>
          <p className="ssoPanel-hint" style={{ margin: 0 }}>
            Ứng dụng hiển thị ở trang chủ + người được phép truy cập từng ứng dụng.
          </p>
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
          Thêm ứng dụng
        </Button>
      </div>

      <Table<AdminApp>
        style={{ marginTop: 20 }}
        rowKey="app_id"
        loading={apps === null}
        dataSource={apps ?? []}
        pagination={false}
        columns={[
          {
            title: 'Ứng dụng',
            dataIndex: 'app_name',
            render: (_, app) => (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span
                  style={{
                    width: 30,
                    height: 30,
                    borderRadius: 8,
                    background: app.color,
                    color: '#fff',
                    display: 'grid',
                    placeItems: 'center',
                    fontWeight: 700,
                    fontSize: '0.8125rem',
                    flex: 'none',
                  }}
                >
                  {app.app_name.trim().charAt(0).toUpperCase()}
                </span>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 600 }}>{app.app_name}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>
                    {app.app_key}
                  </div>
                </div>
              </div>
            ),
          },
          {
            title: 'URL',
            dataIndex: 'url',
            render: (url: string) =>
              url ? (
                <span style={{ fontSize: '0.78125rem' }}>{url}</span>
              ) : (
                <Tag color="warning">Chưa cấu hình URL</Tag>
              ),
          },
          {
            title: 'Quyền truy cập',
            dataIndex: 'access_count',
            width: 160,
            render: (count: number, app) => (
              <Button size="small" icon={<TeamOutlined />} onClick={() => openAccess(app)}>
                {count} người
              </Button>
            ),
          },
          {
            title: '',
            key: 'actions',
            width: 90,
            render: (_, app) => (
              <div style={{ display: 'flex', gap: 6 }}>
                <Button
                  size="small"
                  type="text"
                  icon={<EditOutlined />}
                  onClick={() => openEdit(app)}
                  aria-label="Sửa"
                />
                <Popconfirm
                  title="Xoá ứng dụng này?"
                  description="Toàn bộ quyền truy cập đã cấp cũng bị xoá."
                  okText="Xoá"
                  okButtonProps={{ danger: true }}
                  cancelText="Huỷ"
                  onConfirm={() => handleDelete(app)}
                >
                  <Button size="small" type="text" danger icon={<DeleteOutlined />} aria-label="Xoá" />
                </Popconfirm>
              </div>
            ),
          },
        ]}
      />

      <Modal
        title={appForm.getFieldValue('app_id') ? 'Sửa ứng dụng' : 'Thêm ứng dụng'}
        open={appModalOpen}
        onCancel={() => setAppModalOpen(false)}
        onOk={() => appForm.submit()}
        confirmLoading={savingApp}
        okText="Lưu"
        cancelText="Huỷ"
        destroyOnClose
      >
        <Form form={appForm} layout="vertical" onFinish={handleSaveApp}>
          <Form.Item name="app_id" hidden>
            <Input />
          </Form.Item>
          <Form.Item
            name="app_key"
            label="Mã ứng dụng"
            rules={[
              ...RULES_FORM.required,
              {
                pattern: /^[a-z0-9-]+$/,
                message: 'Chỉ chữ thường, số và dấu gạch ngang (vd: build-web)',
              },
            ]}
          >
            <Input placeholder="vd: chat" />
          </Form.Item>
          <Form.Item name="app_name" label="Tên hiển thị" rules={RULES_FORM.required}>
            <Input placeholder="vd: Trò chuyện" />
          </Form.Item>
          <Form.Item name="description" label="Mô tả ngắn">
            <Input placeholder="Hiện dưới tên ở trang chủ" />
          </Form.Item>
          <Form.Item
            name="url"
            label="URL"
            rules={[{ type: 'url', message: 'URL không hợp lệ' }]}
          >
            <Input placeholder="https://..." />
          </Form.Item>
          <Form.Item name="color" label="Màu icon">
            <Input type="color" style={{ width: 72, padding: 4 }} />
          </Form.Item>
          <Form.Item name="sort_order" label="Thứ tự hiển thị">
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={accessApp ? `Phân quyền truy cập · ${accessApp.app_name}` : ''}
        open={!!accessApp}
        onCancel={() => setAccessApp(null)}
        onOk={handleSaveAccess}
        confirmLoading={savingAccess}
        okText="Lưu"
        cancelText="Huỷ"
        destroyOnClose
        width={640}
      >
        <p className="ssoPanel-hint" style={{ marginTop: 0 }}>
          Chỉ những người được chọn dưới đây mới thấy ứng dụng này ở trang chủ. Quản trị viên luôn
          thấy được mọi ứng dụng. Đã chọn {accessUserIds.length} người.
        </p>
        <Input.Search
          placeholder="Tìm theo tên hoặc tài khoản..."
          allowClear
          value={accessSearch}
          onChange={(e) => {
            setAccessSearch(e.target.value);
            setAccessPage(1);
          }}
          style={{ marginBottom: 12 }}
        />
        <Table<AccessRow>
          rowKey="key"
          size="small"
          bordered
          loading={users === null}
          dataSource={accessRows}
          pagination={false}
          // Cuộn riêng phần thân bảng (header + ô tìm kiếm + phân trang +
          // footer Lưu/Huỷ của Modal luôn cố định, không bị đẩy trôi xuống
          // dưới màn hình khi 1 trang đầy đủ 20 người quá dài).
          scroll={{ y: 360 }}
          rowClassName={(row) => (row.kind === 'position' ? 'ssoAccessTable-groupRow' : '')}
          columns={[
            {
              title: '',
              key: 'select',
              width: 44,
              render: (_, row) => {
                if (row.kind === 'user') {
                  return (
                    <Checkbox
                      checked={accessUserIds.includes(row.user.user_id)}
                      onChange={(e) => toggleAccessUser(row.user.user_id, e.target.checked)}
                    />
                  );
                }
                const ids = membersOfPosition(row.position_name);
                const selectedCount = ids.filter((id) => accessUserIds.includes(id)).length;
                return (
                  <Checkbox
                    checked={ids.length > 0 && selectedCount === ids.length}
                    indeterminate={selectedCount > 0 && selectedCount < ids.length}
                    onChange={(e) => toggleAccessGroup(ids, e.target.checked)}
                  />
                );
              },
            },
            {
              title: 'Người / Chức vụ',
              key: 'name',
              render: (_, row) => {
                if (row.kind === 'position') {
                  return (
                    <Space size={8}>
                      <Typography.Text strong>{row.position_name}</Typography.Text>
                      <Tag>{membersOfPosition(row.position_name).length} người</Tag>
                    </Space>
                  );
                }
                return (
                  <Space>
                    <Avatar
                      size={26}
                      src={avatarSrc(row.user.avatar)}
                      style={{ background: avatarColor(row.user.user_id), flex: 'none' }}
                    >
                      {row.user.full_name.trim().charAt(0).toUpperCase()}
                    </Avatar>
                    <div>
                      <div>{row.user.full_name}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>
                        @{row.user.user_name}
                      </div>
                    </div>
                  </Space>
                );
              },
            },
          ]}
        />
        {accessTotal > ACCESS_PAGE_SIZE && (
          <Pagination
            style={{ marginTop: 12, textAlign: 'right' }}
            size="small"
            current={accessPage}
            pageSize={ACCESS_PAGE_SIZE}
            total={accessTotal}
            onChange={setAccessPage}
            showSizeChanger={false}
          />
        )}
      </Modal>
    </div>
  );
}
