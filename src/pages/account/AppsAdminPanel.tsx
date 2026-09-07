import { DeleteOutlined, EditOutlined, PlusOutlined, TeamOutlined } from '@ant-design/icons';
import {
  App as AntdApp,
  Button,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Table,
  Tag,
} from 'antd';
import { useEffect, useState } from 'react';

import {
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

// 1 dòng người dùng trong bảng phân quyền, gắn thêm `positionRowSpan` để gộp
// ô "Chức vụ" theo nhóm (kiểu bảng Excel group-by) - dòng đầu mỗi nhóm mang
// rowSpan = số người trong nhóm, các dòng sau trong cùng nhóm mang 0 (antd
// Table tự ẩn ô đó khi rowSpan=0, xem onCell bên dưới).
interface AccessRow extends AdminUser {
  positionRowSpan: number;
}

const UNASSIGNED_POSITION = 'Chưa gán chức vụ';

// Sort theo chức vụ rồi tên (gom nhóm liền kề bắt buộc để rowSpan đúng - antd
// merge-cell chỉ hoạt động khi các dòng cùng nhóm nằm sát nhau), rồi gắn
// rowSpan cho dòng đầu mỗi nhóm.
const buildAccessRows = (users: AdminUser[]): AccessRow[] => {
  const sorted = [...users].sort((a, b) => {
    const posA = a.position_name || UNASSIGNED_POSITION;
    const posB = b.position_name || UNASSIGNED_POSITION;
    return posA !== posB
      ? posA.localeCompare(posB, 'vi')
      : a.full_name.localeCompare(b.full_name, 'vi');
  });

  const rows: AccessRow[] = [];
  for (let i = 0; i < sorted.length; ) {
    const pos = sorted[i].position_name || UNASSIGNED_POSITION;
    let j = i;
    while (j < sorted.length && (sorted[j].position_name || UNASSIGNED_POSITION) === pos) j++;
    for (let k = i; k < j; k++) {
      rows.push({ ...sorted[k], positionRowSpan: k === i ? j - i : 0 });
    }
    i = j;
  }
  return rows;
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

  const accessSearchLower = accessSearch.trim().toLowerCase();
  const filteredAccessUsers = (users ?? []).filter(
    (u) =>
      !accessSearchLower ||
      u.full_name.toLowerCase().includes(accessSearchLower) ||
      u.user_name.toLowerCase().includes(accessSearchLower),
  );
  const accessRows = buildAccessRows(filteredAccessUsers);

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
                    fontSize: 13,
                    flex: 'none',
                  }}
                >
                  {app.app_name.trim().charAt(0).toUpperCase()}
                </span>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 600 }}>{app.app_name}</div>
                  <div style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>
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
                <span style={{ fontSize: 12.5 }}>{url}</span>
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
          onChange={(e) => setAccessSearch(e.target.value)}
          style={{ marginBottom: 12 }}
        />
        <Table<AccessRow>
          rowKey="user_id"
          size="small"
          loading={users === null}
          dataSource={accessRows}
          pagination={false}
          scroll={{ y: 360 }}
          rowSelection={{
            selectedRowKeys: accessUserIds,
            onChange: (keys) => setAccessUserIds(keys as string[]),
          }}
          columns={[
            {
              title: 'Chức vụ',
              dataIndex: 'position_name',
              width: 150,
              // rowSpan=0 -> antd tự ẩn ô (gộp vào dòng đầu nhóm phía trên).
              onCell: (row) => ({ rowSpan: row.positionRowSpan }),
              render: (_, row) => (
                <span style={{ fontWeight: 600 }}>{row.position_name || UNASSIGNED_POSITION}</span>
              ),
            },
            {
              title: 'Họ tên',
              dataIndex: 'full_name',
            },
            {
              title: 'Tài khoản',
              dataIndex: 'user_name',
              width: 140,
              render: (v: string) => (
                <span style={{ color: 'var(--color-text-secondary)' }}>@{v}</span>
              ),
            },
          ]}
        />
      </Modal>
    </div>
  );
}
