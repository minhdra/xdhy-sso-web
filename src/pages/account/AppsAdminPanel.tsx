import { DeleteOutlined, EditOutlined, PlusOutlined, TeamOutlined, UploadOutlined } from '@ant-design/icons';
import { Alert, App as AntdApp, Avatar, Button, Checkbox, Empty, Form, Input, InputNumber, Modal, Popconfirm, Skeleton, Space, Table, Tag, Tooltip, Typography, Upload } from 'antd';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { addAppAccessRequest, avatarSrc, deleteAppRequest, getAdminApps, getAdminUsers, getAppAccessRequest, removeAppAccessRequest, uploadAppIconRequest, upsertAppRequest, type AdminApp, type AdminUser } from '../../api';
import { RULES_FORM } from '../../validator';
import { resizeImage } from '../../imageResize';

interface AppFormValues { app_id?: string | null; app_key: string; app_name: string; description?: string; url?: string; color?: string; sort_order?: number }
type AccessRow<T extends AdminUser> = { kind: 'position'; key: string; position_name: string; users: T[] } | { kind: 'user'; key: string; user: T };
const UNASSIGNED_POSITION = 'Chưa gán chức vụ';

const buildAccessRows = <T extends AdminUser>(users: T[]): AccessRow<T>[] => {
  const groups = new Map<string, T[]>();
  users.forEach((user) => {
    const position = user.position_name || UNASSIGNED_POSITION;
    groups.set(position, [...(groups.get(position) ?? []), user]);
  });
  return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b, 'vi')).flatMap(([position, members]) => [
    { kind: 'position' as const, key: `position-${position}`, position_name: position, users: members },
    ...members.sort((a, b) => a.full_name.localeCompare(b.full_name, 'vi')).map((user) => ({ kind: 'user' as const, key: user.user_id, user })),
  ]);
};

const avatarColor = (id: string): string => {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return `hsl(${hash % 360}, 45%, 42%)`;
};

const UserIdentity = ({ user }: { user: AdminUser }) => (
  <Space size={10}>
    <Avatar shape="square" size={30} src={avatarSrc(user.avatar)} style={{ background: avatarColor(user.user_id), flex: 'none' }}>
      {user.full_name.trim().charAt(0).toUpperCase()}
    </Avatar>
    <div className="ssoAccess-userIdentity"><span>{user.full_name}</span><small>@{user.user_name}</small></div>
  </Space>
);

export default function AppsAdminPanel() {
  const { notification } = AntdApp.useApp();
  const [apps, setApps] = useState<AdminApp[] | null>(null);
  const [appsError, setAppsError] = useState(false);
  const [appModalOpen, setAppModalOpen] = useState(false);
  const [appForm] = Form.useForm<AppFormValues>();
  const [savingApp, setSavingApp] = useState(false);
  const [iconFile, setIconFile] = useState<File | null>(null);
  const [iconPreview, setIconPreview] = useState<string | null>(null);
  const [accessApp, setAccessApp] = useState<AdminApp | null>(null);
  const [accessUsers, setAccessUsers] = useState<AdminUser[] | null>(null);
  const [accessError, setAccessError] = useState(false);
  const [accessSearch, setAccessSearch] = useState('');
  const [originalAccessIds, setOriginalAccessIds] = useState<string[]>([]);
  const [accessUserIds, setAccessUserIds] = useState<string[]>([]);
  const [savingAccess, setSavingAccess] = useState(false);
  const [showUnassigned, setShowUnassigned] = useState(false);

  const loadApps = useCallback(async () => {
    setAppsError(false);
    try {
      const res = await getAdminApps();
      if (!res.ok) throw new Error(res.data.message);
      setApps(res.data);
    } catch {
      setAppsError(true);
      setApps((current) => current ?? []);
    }
  }, []);
  useEffect(() => void loadApps(), [loadApps]);

  const loadAccessUsers = useCallback(async (appId: string) => {
    setAccessUsers(null);
    setAccessError(false);
    try {
      const [usersRes, accessRes] = await Promise.all([getAdminUsers(), getAppAccessRequest(appId)]);
      if (!usersRes.ok || !accessRes.ok) throw new Error('Không tải được danh sách người dùng.');
      const grantedIds = accessRes.data.map((user) => user.user_id);
      setAccessUsers(usersRes.data);
      setOriginalAccessIds(grantedIds);
      setAccessUserIds(grantedIds);
    } catch {
      setAccessError(true);
      setAccessUsers([]);
    }
  }, []);

  const openCreate = () => {
    appForm.resetFields();
    appForm.setFieldsValue({ sort_order: (apps?.length ?? 0) + 1 });
    setIconFile(null); setIconPreview(null);
    setAppModalOpen(true);
  };
  const openEdit = (app: AdminApp) => { setIconFile(null); setIconPreview(avatarSrc(app.icon) ?? null); appForm.setFieldsValue({ ...app, description: app.description ?? '' }); setAppModalOpen(true); };

  const handleSaveApp = async (values: AppFormValues) => {
    setSavingApp(true);
    try {
      const res = await upsertAppRequest(values);
      if (!res.ok) { notification.error({ message: res.data.message || 'Không lưu được ứng dụng.' }); return; }
      if (iconFile) {
        const blob = await resizeImage(iconFile, 138, 'contain', 'image/png');
        if (blob.size > 1024 * 1024) throw new Error('Icon sau khi xử lý vượt quá 1MB.');
        const uploaded = await uploadAppIconRequest(res.data.app_id, blob);
        if (!uploaded.ok) throw new Error(uploaded.data.message || 'Không tải được icon.');
        setApps((current) => current?.map((app) => app.app_id === res.data.app_id
          ? { ...app, icon: uploaded.data.icon } : app) ?? null);
      }
      await loadApps();
      notification.success({ message: 'Đã lưu ứng dụng.' });
      setAppModalOpen(false);
    } catch (error) { notification.error({ message: error instanceof Error ? error.message : 'Không thể kết nối tới máy chủ.' }); void loadApps(); }
    finally { setSavingApp(false); }
  };

  const handleDelete = async (app: AdminApp) => {
    try {
      const res = await deleteAppRequest(app.app_id);
      if (!res.ok) { notification.error({ message: res.data.message || 'Không xoá được ứng dụng.' }); return; }
      setApps((current) => current?.filter((item) => item.app_id !== app.app_id) ?? null);
      notification.success({ message: 'Đã xoá ứng dụng.' });
    } catch { notification.error({ message: 'Không thể kết nối tới máy chủ.' }); }
  };

  const openAccess = (app: AdminApp) => {
    setAccessApp(app); setShowUnassigned(false); setAccessSearch(''); void loadAccessUsers(app.app_id);
  };

  const handleSaveAccess = async () => {
    if (!accessApp) return;
    const original = new Set(originalAccessIds);
    const next = new Set(accessUserIds);
    const added = accessUserIds.filter((id) => !original.has(id));
    const removed = originalAccessIds.filter((id) => !next.has(id));
    if (added.length === 0 && removed.length === 0) return;
    setSavingAccess(true);
    try {
      if (added.length > 0) {
        const res = await addAppAccessRequest(accessApp.app_id, added);
        if (!res.ok) throw new Error(res.data.message);
      }
      if (removed.length > 0) {
        const res = await removeAppAccessRequest(accessApp.app_id, removed);
        if (!res.ok) throw new Error(res.data.message);
      }
      setOriginalAccessIds(accessUserIds);
      notification.success({ message: 'Đã cập nhật quyền truy cập.' });
      setAccessApp(null);
      void loadApps();
    } catch {
      notification.error({ message: 'Không thể cập nhật đầy đủ quyền truy cập. Danh sách đã được tải lại.' });
      void loadAccessUsers(accessApp.app_id);
      void loadApps();
    }
    finally { setSavingAccess(false); }
  };

  const filteredAccessUsers = useMemo(() => {
    const keyword = accessSearch.trim().toLocaleLowerCase('vi');
    return (accessUsers ?? []).filter((user) =>
      (!showUnassigned || !accessUserIds.includes(user.user_id)) &&
      (!keyword || user.full_name.toLocaleLowerCase('vi').includes(keyword) || user.user_name.toLocaleLowerCase('vi').includes(keyword)),
    );
  }, [accessSearch, accessUserIds, accessUsers, showUnassigned]);
  const accessRows = useMemo(() => buildAccessRows(filteredAccessUsers), [filteredAccessUsers]);
  const accessChanges = useMemo(() => {
    const original = new Set(originalAccessIds);
    const next = new Set(accessUserIds);
    return {
      added: accessUserIds.filter((id) => !original.has(id)).length,
      removed: originalAccessIds.filter((id) => !next.has(id)).length,
    };
  }, [accessUserIds, originalAccessIds]);
  const hasAccessChanges = accessChanges.added > 0 || accessChanges.removed > 0;

  const toggleIds = (ids: string[], checked: boolean, selected: string[], setSelected: (ids: string[]) => void) => {
    const next = new Set(selected); ids.forEach((id) => checked ? next.add(id) : next.delete(id)); setSelected([...next]);
  };

  const accessColumns = <T extends AdminUser>(selected: string[], setSelected: (ids: string[]) => void) => [
    { title: '', key: 'select', width: 46, render: (_: unknown, row: AccessRow<T>) => {
      const ids = row.kind === 'position' ? row.users.map((user) => user.user_id) : [row.user.user_id];
      const selectedCount = ids.filter((id) => selected.includes(id)).length;
      return <Checkbox aria-label={row.kind === 'position' ? `Chọn nhóm ${row.position_name}` : `Chọn ${row.user.full_name}`} checked={ids.length > 0 && selectedCount === ids.length} indeterminate={selectedCount > 0 && selectedCount < ids.length} onChange={(event) => toggleIds(ids, event.target.checked, selected, setSelected)} />;
    } },
    { title: 'Người / Chức vụ', key: 'name', render: (_: unknown, row: AccessRow<T>) => row.kind === 'position' ? <Space size={8}><Typography.Text strong>{row.position_name}</Typography.Text><Tag>{row.users.length} người</Tag></Space> : <UserIdentity user={row.user} /> },
  ];

  return <div className="ssoPanel ssoAppsAdmin">
    <div className="ssoPanel-headRow"><div><h2>Quản lý ứng dụng</h2><p className="ssoPanel-hint">Cấu hình ứng dụng và những người được cấp quyền truy cập trực tiếp.</p></div><Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>Thêm ứng dụng</Button></div>
    {appsError && <Alert className="ssoAppsAdmin-alert" type="error" showIcon message="Không tải được danh sách ứng dụng" action={<Button size="small" onClick={() => void loadApps()}>Thử lại</Button>} />}
    {apps === null ? <Skeleton className="ssoAppsAdmin-table" active title={false} paragraph={{ rows: 6 }} /> : <Table<AdminApp> className="ssoAppsAdmin-table" rowKey="app_id" dataSource={apps} pagination={false} locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Chưa có ứng dụng" /> }} columns={[
      { title: 'Ứng dụng', dataIndex: 'app_name', render: (_, app) => <div className="ssoAppsAdmin-appIdentity"><span className="ssoAppsAdmin-appMark" style={{ background: app.icon ? 'transparent' : app.color }}>{app.icon ? <img src={avatarSrc(app.icon)} alt="" width={34} height={34} /> : app.app_name.trim().charAt(0).toUpperCase()}</span><div><strong>{app.app_name}</strong><small>{app.app_key}</small></div></div> },
      { title: 'URL', dataIndex: 'url', responsive: ['md'], render: (url: string) => url ? <span className="ssoAppsAdmin-url">{url}</span> : <Tag color="warning">Chưa cấu hình URL</Tag> },
      { title: 'Người truy cập', dataIndex: 'direct_access_count', width: 190, render: (_: number, app) => <Tooltip title={`${app.direct_access_count} người được cấp trực tiếp. Quản trị viên hệ thống luôn có quyền truy cập.`}><Button className="ssoAppsAdmin-accessCount" type="text" icon={<TeamOutlined />} onClick={() => openAccess(app)}><span>{app.direct_access_count} / {app.eligible_user_count}</span> người</Button></Tooltip> },
      { title: '', key: 'actions', width: 96, render: (_, app) => <Space size={2}><Button type="text" icon={<EditOutlined />} onClick={() => openEdit(app)} aria-label={`Sửa ${app.app_name}`} /><Popconfirm title="Xoá ứng dụng này?" description="Toàn bộ quyền đã cấp cũng bị xoá." okText="Xoá" cancelText="Huỷ" okButtonProps={{ danger: true }} onConfirm={() => handleDelete(app)}><Button type="text" danger icon={<DeleteOutlined />} aria-label={`Xoá ${app.app_name}`} /></Popconfirm></Space> },
    ]} />}

    <Modal title={appForm.getFieldValue('app_id') ? 'Sửa ứng dụng' : 'Thêm ứng dụng'} open={appModalOpen} onCancel={() => setAppModalOpen(false)} onOk={() => appForm.submit()} confirmLoading={savingApp} okText="Lưu" cancelText="Huỷ" destroyOnClose>
      <Form form={appForm} layout="vertical" onFinish={handleSaveApp}>
        <Form.Item name="app_id" hidden><Input /></Form.Item>
        <Form.Item name="app_key" label="Mã ứng dụng" rules={[...RULES_FORM.required, { pattern: /^[a-z0-9-]+$/, message: 'Chỉ chữ thường, số và dấu gạch ngang (vd: build-web)' }]}><Input placeholder="vd: chat" /></Form.Item>
        <Form.Item name="app_name" label="Tên hiển thị" rules={RULES_FORM.required}><Input placeholder="vd: Trò chuyện" /></Form.Item>
        <Form.Item name="description" label="Mô tả ngắn"><Input placeholder="Hiện dưới tên ở trang chủ" /></Form.Item>
        <Form.Item name="url" label="URL" rules={[{ type: 'url', message: 'URL không hợp lệ' }]}><Input placeholder="https://..." /></Form.Item>
        <Form.Item label="Ảnh icon">
          <Space>
            {iconPreview && <img src={iconPreview} alt="Icon đã chọn" width={46} height={46} style={{ objectFit: 'contain' }} />}
            <Upload accept="image/*" showUploadList={false} beforeUpload={(file) => {
              if (!file.type.startsWith('image/') || file.size > 1024 * 1024) {
                notification.error({ message: 'Chọn ảnh tối đa 1MB.' }); return false;
              }
              setIconFile(file); setIconPreview(URL.createObjectURL(file)); return false;
            }}><Button icon={<UploadOutlined />}>Chọn ảnh</Button></Upload>
          </Space>
          <div className="ssoPanel-hint">Ảnh tối đa 1MB</div>
        </Form.Item>
        <Form.Item name="sort_order" label="Thứ tự hiển thị"><InputNumber min={0} className="ssoAppsAdmin-fullWidth" /></Form.Item>
      </Form>
    </Modal>

    <Modal title={accessApp ? `Người truy cập · ${accessApp.app_name}` : ''} open={!!accessApp} onCancel={() => { setAccessApp(null); setShowUnassigned(false); }} onOk={handleSaveAccess} confirmLoading={savingAccess} okButtonProps={{ disabled: !hasAccessChanges || accessUsers === null }} okText={<span className="ssoAccess-saveLabel">Lưu thay đổi · Thêm {accessChanges.added} · Gỡ {accessChanges.removed}</span>} cancelText="Huỷ" width={720} destroyOnClose>
      <div className="ssoAccess-summary"><div><strong>{accessApp?.direct_access_count ?? 0}</strong><span>được cấp trực tiếp</span></div><div><strong>{accessApp?.eligible_user_count ?? 0}</strong><span>người dùng đủ điều kiện</span></div><p>Quản trị viên hệ thống luôn có quyền truy cập và không xuất hiện trong danh sách grant.</p></div>
      <div className="ssoAccess-viewFilter">
        <Checkbox checked={showUnassigned} onChange={(event) => setShowUnassigned(event.target.checked)}>Chỉ người chưa được phân quyền</Checkbox>
      </div>
      <div className="ssoAccess-toolbar"><Input.Search allowClear value={accessSearch} placeholder="Tìm theo tên hoặc tài khoản" onChange={(event) => setAccessSearch(event.target.value)} /></div>
      {accessError && <Alert type="error" showIcon message="Không tải được danh sách người dùng" action={<Button size="small" onClick={() => accessApp && void loadAccessUsers(accessApp.app_id)}>Thử lại</Button>} />}
      {accessUsers === null ? <Skeleton active paragraph={{ rows: 6 }} /> : <Table<AccessRow<AdminUser>> className="ssoAccess-table" rowKey="key" size="small" dataSource={accessRows} pagination={false} scroll={{ y: 360 }} rowClassName={(row) => row.kind === 'position' ? 'ssoAccessTable-groupRow' : ''} locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={accessSearch ? 'Không tìm thấy người phù hợp' : 'Tất cả người dùng đã được phân quyền'} /> }} columns={accessColumns(accessUserIds, setAccessUserIds)} />}
    </Modal>
  </div>;
}
