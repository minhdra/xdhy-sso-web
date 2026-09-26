import { DeleteOutlined, EditOutlined, PlusOutlined } from '@ant-design/icons';
import { Alert, App as AntdApp, Button, Form, Input, Modal, Popconfirm, Space, Table, Tag, Tooltip } from 'antd';
import { useCallback, useEffect, useState } from 'react';

import { deleteOrgRoles, type OrgRole, searchOrgRoles, upsertOrgRole } from '../../api';
import { RULES_FORM } from '../../validator';

const PAGE_SIZE = 20;
// Nhóm "Quản trị hệ thống" - chốt chặn admin, không cho xoá/đổi mã.
const ADMIN_ROLE_CODE = 'sa';

// Nhóm quyền CHUNG cho mọi ứng dụng. Mỗi ứng dụng tự gán tính năng cho nhóm
// (Tài chính: Quản trị hệ thống > Phân quyền; Công việc: Quản trị > Phân quyền
// tính năng). Gán người vào nhóm ở màn Người dùng.
export default function RolesAdminPanel() {
  const { notification } = AntdApp.useApp();
  const [form] = Form.useForm<Partial<OrgRole>>();
  const [rows, setRows] = useState<OrgRole[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [keyword, setKeyword] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [editing, setEditing] = useState<OrgRole | 'new' | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await searchOrgRoles({ pageIndex: page, pageSize: PAGE_SIZE, search_content: keyword });
      if (!res.ok) throw new Error(res.data.message);
      setRows(res.data.data ?? []);
      setTotal(res.data.totalItems ?? 0);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [page, keyword]);
  useEffect(() => void load(), [load]);

  const open = (role?: OrgRole) => setEditing(role ?? 'new');

  // Đổ giá trị SAU khi modal mở (xem OrgUnitsAdminPanel - set trước khi mở form nhận rỗng).
  useEffect(() => {
    if (editing === null) return;
    form.resetFields();
    if (editing !== 'new') form.setFieldsValue({ ...editing, description: editing.description ?? '' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing]);

  const handleSave = async (v: Partial<OrgRole>) => {
    setSaving(true);
    try {
      const res = await upsertOrgRole({
        role_id: editing !== 'new' ? editing?.role_id : null,
        role_code: v.role_code?.trim(),
        role_name: v.role_name?.trim(),
        description: v.description?.trim() ?? '',
      });
      if (!res.ok) {
        notification.error({ message: res.data.message || 'Không lưu được nhóm quyền.' });
        return;
      }
      notification.success({ message: res.data.message || 'Đã lưu nhóm quyền.' });
      setEditing(null);
      void load();
    } catch {
      notification.error({ message: 'Không thể kết nối tới máy chủ.' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (role: OrgRole) => {
    try {
      const res = await deleteOrgRoles([role.role_id]);
      if (!res.ok) {
        notification.error({ message: res.data.message || 'Không xoá được nhóm quyền.' });
        return;
      }
      notification.success({ message: res.data.message || 'Đã xoá nhóm quyền.' });
      void load();
    } catch {
      notification.error({ message: 'Không thể kết nối tới máy chủ.' });
    }
  };

  const isAdminRole = editing !== 'new' && editing?.role_code === ADMIN_ROLE_CODE;

  return (
    <div className="ssoPanel ssoAppsAdmin">
      <div className="ssoPanel-headRow">
        <div>
          <h2>Nhóm quyền</h2>
          <p className="ssoPanel-hint">
            Nhóm quyền dùng chung. Mỗi ứng dụng tự gán tính năng cho nhóm; gán người vào nhóm ở mục Người dùng.
          </p>
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => open()}>
          Thêm nhóm quyền
        </Button>
      </div>

      <Input.Search
        allowClear
        className="ssoOrg-filters"
        placeholder="Tìm nhóm quyền"
        style={{ maxWidth: 360 }}
        onSearch={(v) => {
          setPage(1);
          setKeyword(v.trim());
        }}
      />

      {error && (
        <Alert
          className="ssoAppsAdmin-alert"
          type="error"
          showIcon
          message="Không tải được danh sách nhóm quyền"
          action={<Button size="small" onClick={() => void load()}>Thử lại</Button>}
        />
      )}

      <Table<OrgRole>
        className="ssoAppsAdmin-table"
        rowKey="role_id"
        size="small"
        loading={loading}
        dataSource={rows}
        scroll={{ x: 480 }}
        pagination={{ current: page, pageSize: PAGE_SIZE, total, showSizeChanger: false, onChange: setPage }}
        columns={[
          {
            title: 'Nhóm quyền',
            key: 'name',
            render: (_, r) => (
              <Space size={8} wrap>
                <strong>{r.role_name}</strong>
                <Tag>{r.role_code}</Tag>
              </Space>
            ),
          },
          { title: 'Mô tả', dataIndex: 'description', ellipsis: true, responsive: ['md'] },
          {
            title: '',
            key: 'actions',
            width: 96,
            render: (_, r) => {
              const locked = r.role_code === ADMIN_ROLE_CODE;
              return (
                <Space size={0}>
                  <Tooltip title="Sửa">
                    <Button type="text" icon={<EditOutlined />} onClick={() => open(r)} />
                  </Tooltip>
                  <Popconfirm
                    title="Xoá nhóm quyền này?"
                    description="Người trong nhóm mất các tính năng của nhóm ở mọi ứng dụng."
                    okText="Xoá"
                    cancelText="Huỷ"
                    okButtonProps={{ danger: true }}
                    disabled={locked}
                    onConfirm={() => handleDelete(r)}
                  >
                    <Tooltip title={locked ? 'Không xoá được nhóm quản trị hệ thống' : 'Xoá'}>
                      <Button type="text" danger disabled={locked} icon={<DeleteOutlined />} />
                    </Tooltip>
                  </Popconfirm>
                </Space>
              );
            },
          },
        ]}
      />

      <Modal
        title={editing === 'new' ? 'Thêm nhóm quyền' : 'Sửa nhóm quyền'}
        open={editing !== null}
        onCancel={() => setEditing(null)}
        onOk={() => form.submit()}
        confirmLoading={saving}
        okText="Lưu"
        cancelText="Huỷ"
        destroyOnHidden
      >
        <Form form={form} layout="vertical" onFinish={handleSave}>
          <Form.Item
            name="role_code"
            label="Mã nhóm"
            extra={isAdminRole ? 'Mã nhóm quản trị hệ thống không đổi được.' : undefined}
            rules={[
              ...RULES_FORM.required,
              { pattern: /^[A-Za-z0-9_-]+$/, message: 'Chỉ gồm chữ, số, "_" và "-"' },
              { max: 50 },
            ]}
          >
            <Input disabled={isAdminRole} />
          </Form.Item>
          <Form.Item name="role_name" label="Tên nhóm" rules={[...RULES_FORM.required, { max: 250 }]}>
            <Input />
          </Form.Item>
          <Form.Item name="description" label="Mô tả">
            <Input.TextArea autoSize={{ minRows: 2, maxRows: 4 }} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
