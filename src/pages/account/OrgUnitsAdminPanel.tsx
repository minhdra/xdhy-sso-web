import { DeleteOutlined, EditOutlined, PlusOutlined } from '@ant-design/icons';
import { Alert, App as AntdApp, Button, Form, Input, InputNumber, Modal, Popconfirm, Segmented, Space, Table, Tag, Tooltip } from 'antd';
import { useCallback, useEffect, useState } from 'react';

import { deleteOrgUnits, type OrgUnitKind, type OrgUnitRow, searchOrgUnits, upsertOrgUnit } from '../../api';
import { maxLen, RULES_FORM } from '../../validator';
import { TABLE_SCROLL_Y } from '../../tableScroll';

const PAGE_SIZE = 20;

// Cấu hình từng loại: tên cột id/tên trong API + field phụ.
const KINDS: Record<OrgUnitKind, { label: string; idKey: keyof OrgUnitRow; nameKey: keyof OrgUnitRow; contact: boolean }> = {
  branches: { label: 'Chi nhánh', idKey: 'branch_id', nameKey: 'branch_name', contact: true },
  departments: { label: 'Phòng ban', idKey: 'department_id', nameKey: 'department_name', contact: true },
  positions: { label: 'Chức vụ', idKey: 'position_id', nameKey: 'position_name', contact: false },
};

interface UnitForm {
  id?: number | null;
  name: string;
  phone?: string;
  fax?: string;
  address?: string;
  description?: string;
  rank_weight?: number | null;
}

// Chi nhánh / phòng ban / chức vụ (chuyển từ build-web). Trọng số cấp bậc của chức vụ
// (rank_weight, phân quyền giám sát ở app Công việc) quản lý TẬP TRUNG ở đây từ 14/10/2026 -
// api-sso đồng bộ sang Công việc/Tài chính cùng tên, mô tả chức vụ.
export default function OrgUnitsAdminPanel() {
  const { notification } = AntdApp.useApp();
  const [kind, setKind] = useState<OrgUnitKind>('branches');
  const cfg = KINDS[kind];
  const [form] = Form.useForm<UnitForm>();
  const [rows, setRows] = useState<OrgUnitRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [keyword, setKeyword] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingRow, setEditingRow] = useState<OrgUnitRow | null>(null);
  const isEdit = !!editingRow;
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await searchOrgUnits(kind, { pageIndex: page, pageSize: PAGE_SIZE, search_content: keyword });
      if (!res.ok) throw new Error(res.data.message);
      setRows(res.data.data ?? []);
      setTotal(res.data.totalItems ?? 0);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [kind, page, keyword]);
  useEffect(() => void load(), [load]);

  const open = (row?: OrgUnitRow) => {
    setEditingRow(row ?? null);
    setModalOpen(true);
  };

  // Đổ giá trị SAU khi modal mở (Form mới gắn vào lúc đó) - set trước khi mở
  // thì form nhận rỗng, bấm Lưu thành thêm mới thay vì sửa (bug đã gặp khi test).
  useEffect(() => {
    if (!modalOpen) return;
    form.resetFields();
    if (editingRow) {
      form.setFieldsValue({
        id: editingRow[cfg.idKey] as number,
        name: editingRow[cfg.nameKey] as string,
        phone: editingRow.phone ?? '',
        fax: editingRow.fax ?? '',
        address: editingRow.address ?? '',
        description: editingRow.description ?? '',
        rank_weight: editingRow.rank_weight ?? null,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modalOpen, editingRow]);

  const handleSave = async (v: UnitForm) => {
    setSaving(true);
    try {
      const nameField = cfg.nameKey as string;
      const idField = cfg.idKey as string;
      const payload: Record<string, unknown> = { [idField]: v.id ?? null, [nameField]: v.name.trim() };
      if (cfg.contact) Object.assign(payload, { phone: v.phone ?? '', fax: v.fax ?? '', address: v.address ?? '' });
      else payload.description = v.description ?? '';
      // Chức vụ luôn gửi trọng số (null = chưa xếp cấp) - đồng bộ sang Công việc/Tài chính.
      if (kind === 'positions') payload.rank_weight = v.rank_weight ?? null;
      const res = await upsertOrgUnit(kind, payload);
      if (!res.ok) {
        notification.error({ message: res.data.message || 'Không lưu được.' });
        return;
      }
      notification.success({ message: res.data.message || 'Đã lưu.' });
      setModalOpen(false);
      void load();
    } catch {
      notification.error({ message: 'Không thể kết nối tới máy chủ.' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (row: OrgUnitRow) => {
    try {
      const res = await deleteOrgUnits(kind, [row[cfg.idKey] as number]);
      if (!res.ok) {
        notification.error({ message: res.data.message || 'Không xoá được.' });
        return;
      }
      notification.success({ message: res.data.message || 'Đã xoá.' });
      void load();
    } catch {
      notification.error({ message: 'Không thể kết nối tới máy chủ.' });
    }
  };

  return (
    <div className="ssoPanel ssoAppsAdmin">
      <div className="ssoPanel-headRow">
        <div>
          <h2>Tổ chức</h2>
          <p className="ssoPanel-hint">Chi nhánh, phòng ban và chức vụ dùng chung cho mọi ứng dụng.</p>
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => open()}>
          Thêm {cfg.label.toLowerCase()}
        </Button>
      </div>

      <Space wrap className="ssoOrg-filters" style={{ width: '100%', justifyContent: 'space-between' }}>
        <Segmented
          value={kind}
          onChange={(v) => {
            // Xoá dữ liệu loại cũ NGAY: rowKey đổi theo loại mới, để rows cũ lại thì
            // mọi key thành "undefined" (trùng) -> React để sót dòng rỗng.
            setRows([]);
            setTotal(0);
            setKind(v as OrgUnitKind);
            setPage(1);
            setKeyword('');
          }}
          options={(Object.keys(KINDS) as OrgUnitKind[]).map((k) => ({ value: k, label: KINDS[k].label }))}
        />
        <Input.Search
          key={kind}
          allowClear
          placeholder={`Tìm ${cfg.label.toLowerCase()}`}
          style={{ width: 260, maxWidth: '100%' }}
          onSearch={(v) => {
            setPage(1);
            setKeyword(v.trim());
          }}
        />
      </Space>

      {error && (
        <Alert
          className="ssoAppsAdmin-alert"
          type="error"
          showIcon
          message="Không tải được danh sách"
          action={<Button size="small" onClick={() => void load()}>Thử lại</Button>}
        />
      )}

      <Table<OrgUnitRow>
        className="ssoAppsAdmin-table"
        rowKey={(r) => `${kind}-${String(r[cfg.idKey])}`}
        size="small"
        loading={loading}
        dataSource={rows}
        scroll={{ x: 520, y: TABLE_SCROLL_Y }}
        pagination={{ current: page, pageSize: PAGE_SIZE, total, showSizeChanger: false, onChange: setPage }}
        columns={[
          { title: cfg.label, key: 'name', render: (_, r) => <strong>{r[cfg.nameKey] as string}</strong> },
          ...(cfg.contact
            ? [
                { title: 'Điện thoại', dataIndex: 'phone', responsive: ['md' as const] },
                { title: 'Địa chỉ', dataIndex: 'address', ellipsis: true, responsive: ['lg' as const] },
              ]
            : [
                ...(kind === 'positions'
                  ? [
                      {
                        title: 'Trọng số',
                        dataIndex: 'rank_weight',
                        width: 110,
                        align: 'center' as const,
                        render: (v: number | null | undefined) =>
                          v == null ? <Tag>Chưa xếp cấp</Tag> : <strong>{v}</strong>,
                      },
                    ]
                  : []),
                { title: 'Mô tả', dataIndex: 'description', ellipsis: true, responsive: ['md' as const] },
              ]),
          // Cả 3 loại: số nhân sự đang hoạt động thuộc mục đó.
          { title: 'Số nhân sự', dataIndex: 'employee_count', width: 110, align: 'center' as const },
          {
            title: '',
            key: 'actions',
            width: 96,
            render: (_, r) => (
              <Space size={0}>
                <Tooltip title="Sửa">
                  <Button type="text" icon={<EditOutlined />} onClick={() => open(r)} />
                </Tooltip>
                <Popconfirm
                  title={`Xoá ${cfg.label.toLowerCase()} này?`}
                  description="Người dùng đang thuộc mục này vẫn giữ nguyên, cần chuyển sang mục khác."
                  okText="Xoá"
                  cancelText="Huỷ"
                  okButtonProps={{ danger: true }}
                  onConfirm={() => handleDelete(r)}
                >
                  <Tooltip title="Xoá">
                    <Button type="text" danger icon={<DeleteOutlined />} />
                  </Tooltip>
                </Popconfirm>
              </Space>
            ),
          },
        ]}
      />

      <Modal
        title={`${isEdit ? 'Sửa' : 'Thêm'} ${cfg.label.toLowerCase()}`}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={() => form.submit()}
        confirmLoading={saving}
        okText="Lưu"
        cancelText="Huỷ"
        destroyOnHidden
      >
        <Form form={form} layout="vertical" onFinish={handleSave}>
          <Form.Item name="id" hidden>
            <Input />
          </Form.Item>
          <Form.Item name="name" label={`Tên ${cfg.label.toLowerCase()}`} validateFirst rules={[...RULES_FORM.required, ...RULES_FORM.text, maxLen(250)]}>
            <Input placeholder={`Nhập tên ${cfg.label.toLowerCase()}`} />
          </Form.Item>
          {cfg.contact ? (
            <>
              <Form.Item name="phone" label="Điện thoại" rules={RULES_FORM.landline}>
                <Input placeholder="vd: 0221 3861 234" />
              </Form.Item>
              <Form.Item name="fax" label="Fax" rules={RULES_FORM.landline}>
                <Input placeholder="Số fax (nếu có)" />
              </Form.Item>
              <Form.Item name="address" label="Địa chỉ" validateFirst rules={[...RULES_FORM.text, maxLen(250)]}>
                <Input placeholder="Số nhà, đường, phường/xã, tỉnh/thành" />
              </Form.Item>
            </>
          ) : (
            <Form.Item name="description" label="Mô tả" validateFirst rules={[...RULES_FORM.text, maxLen(500)]}>
              <Input.TextArea autoSize={{ minRows: 2, maxRows: 4 }} placeholder="Nhiệm vụ, phạm vi của chức vụ" />
            </Form.Item>
          )}
          {kind === 'positions' && (
            <Form.Item
              name="rank_weight"
              label="Trọng số cấp bậc"
              extra="Số lớn là cấp cao hơn; hai chức vụ cùng số là ngang hàng. Để trống = chưa xếp cấp (chỉ thấy việc của chính mình). Ứng dụng Công việc dùng số này để quyết định ai xem và sửa được việc của ai (ví dụ: Ban Giám đốc 100, Chỉ huy trưởng 80, Giám sát 60, Kỹ sư 40)."
            >
              <InputNumber min={1} max={1000} precision={0} style={{ width: '100%' }} placeholder="Chưa xếp cấp (1 đến 1000)" />
            </Form.Item>
          )}
        </Form>
      </Modal>
    </div>
  );
}
