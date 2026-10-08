import { ReloadOutlined, StopOutlined, SyncOutlined, ThunderboltOutlined } from '@ant-design/icons';
import {
  Alert,
  App as AntdApp,
  Button,
  Card,
  Col,
  Input,
  Popconfirm,
  Row,
  Select,
  Skeleton,
  Space,
  Statistic,
  Table,
  Tag,
  Tooltip,
  Typography,
} from 'antd';
import dayjs from 'dayjs';
import { useCallback, useEffect, useRef, useState } from 'react';

import {
  getSyncHistory,
  getSyncStatus,
  resyncTarget,
  retrySync,
  skipSync,
  type SyncEntity,
  type SyncHistoryFilter,
  type SyncLogRow,
  type SyncRowStatus,
  type SyncStatus,
  type SyncTarget,
} from '../../api';

const TARGETS: { key: SyncTarget; label: string }[] = [
  { key: 'finance', label: 'Tài chính' },
  { key: 'task', label: 'Công việc' },
  { key: 'chat', label: 'Chat' },
  { key: 'meeting', label: 'Họp' },
];
const targetLabel = (t: string) => TARGETS.find((x) => x.key === t)?.label ?? t;

const ENTITIES: { key: SyncEntity; label: string }[] = [
  { key: 'user', label: 'Người dùng' },
  { key: 'user_roles', label: 'Nhóm quyền của người dùng' },
  { key: 'branch', label: 'Chi nhánh' },
  { key: 'department', label: 'Phòng ban' },
  { key: 'position', label: 'Chức vụ' },
  { key: 'role', label: 'Nhóm quyền' },
];
const entityLabel = (e: string) => ENTITIES.find((x) => x.key === e)?.label ?? e;

const STATUSES: { key: SyncRowStatus; label: string }[] = [
  { key: 'pending', label: 'Đang chờ' },
  { key: 'done', label: 'Thành công' },
  { key: 'failed', label: 'Lỗi' },
  { key: 'skipped', label: 'Đã bỏ qua' },
];

function statusTag(row: SyncLogRow) {
  if (row.status === 'pending') {
    return row.attempts > 0 ? <Tag color="warning">Đang thử lại</Tag> : <Tag color="processing">Đang chờ</Tag>;
  }
  if (row.status === 'done') return <Tag color="success">Thành công</Tag>;
  if (row.status === 'failed') return <Tag color="error">Lỗi</Tag>;
  return <Tag>Đã bỏ qua</Tag>;
}

// Lỗi thô từ worker có dạng "POST users: HTTP 500 {json...}" hoặc lỗi mạng.
// Diễn giải sang câu admin hiểu được + việc cần làm; lỗi thô vẫn xem được
// trong dòng mở rộng.
function describeSyncError(raw: string | null, target: string): string | null {
  if (!raw) return null;
  const app = targetLabel(target);
  const m = raw.match(/HTTP (\d{3})\s*([\s\S]*)$/);
  const status = m ? Number(m[1]) : null;
  let detail = m?.[2]?.trim() ?? '';
  try {
    const body = JSON.parse(detail) as { message?: unknown; error?: unknown };
    const msg = body.message ?? body.error;
    if (typeof msg === 'string' && msg) detail = msg;
  } catch {
    // body không phải JSON - giữ nguyên
  }
  const text = `${raw} ${detail}`;
  if (/unique|duplicate|already exists|đã tồn tại|trùng/i.test(text)) {
    if (/phone|số điện thoại|sđt/i.test(text)) {
      return `Số điện thoại trùng với một tài khoản khác ở ${app}. Sửa số điện thoại ở mục Người dùng rồi bấm Thử lại.`;
    }
    if (/email/i.test(text)) {
      return `Email trùng với một tài khoản khác ở ${app}. Sửa email ở mục Người dùng rồi bấm Thử lại.`;
    }
    if (/nickname|user_?name|tên đăng nhập/i.test(text)) {
      return `Tên đăng nhập trùng với một tài khoản khác ở ${app}.`;
    }
    return `Dữ liệu bị trùng ở ${app}: ${detail || raw}`;
  }
  if (status === null || [408, 429, 502, 503, 504].includes(status)) {
    return `Không kết nối được ${app} (ứng dụng đang tắt hoặc mạng lỗi). Hệ thống tự thử lại; bấm Thử lại ngay khi ứng dụng đã chạy lại.`;
  }
  if (status === 401 || status === 403) return `${app} từ chối khoá đồng bộ (cấu hình secret không khớp).`;
  if (status === 404) return `${app} không có địa chỉ nhận đồng bộ này (sai URL cấu hình hoặc phiên bản cũ).`;
  if (status >= 500) return `${app} báo lỗi khi xử lý: ${detail || raw}`;
  return `${app} từ chối dữ liệu: ${detail || raw}`;
}

const fmt = (v: string | null | undefined, f = 'DD/MM/YYYY HH:mm:ss') => (v ? dayjs(v).format(f) : '');

type ActResult = { ok: boolean; data: { message?: string } };

// Trạng thái + nhật ký đồng bộ SSO -> ứng dụng (hàng đợi a_sync_outbox). Mọi
// xử lý sự cố làm ngay tại đây, không phải vào DB:
//   - "Thử lại ngay": đưa dòng lỗi + dòng đang chờ backoff gửi lại ngay.
//   - "Bỏ qua": bỏ dòng đang chặn / lỗi để hàng đợi đi tiếp.
//   - Nhật ký: mọi thay đổi đã/đang đồng bộ, lọc + phân trang, thao tác từng dòng.
export default function SyncAdminPanel() {
  const { notification } = AntdApp.useApp();
  const [status, setStatus] = useState<SyncStatus | null>(null);
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const [filter, setFilter] = useState<SyncHistoryFilter>({ pageIndex: 1, pageSize: 20 });
  const [search, setSearch] = useState('');
  const [logs, setLogs] = useState<SyncLogRow[]>([]);
  const [total, setTotal] = useState(0);
  const [logsLoading, setLogsLoading] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const filterRef = useRef(filter);
  filterRef.current = filter;

  const loadStatus = useCallback(async () => {
    setError(false);
    try {
      const res = await getSyncStatus();
      if (!res.ok) throw new Error(res.data.message);
      setStatus(res.data);
    } catch {
      setError(true);
    }
  }, []);

  const loadLogs = useCallback(async (silent = false) => {
    if (!silent) setLogsLoading(true);
    try {
      const res = await getSyncHistory(filterRef.current);
      if (!res.ok) throw new Error(res.data.message);
      setLogs(res.data.data);
      setTotal(res.data.totalItems);
      // Giữ lựa chọn còn hiển thị trên trang.
      setSelected((prev) => prev.filter((id) => res.data.data.some((r) => r.id === id)));
    } catch {
      if (!silent) setError(true);
    } finally {
      if (!silent) setLogsLoading(false);
    }
  }, []);

  const refresh = useCallback(() => {
    void loadStatus();
    void loadLogs(true);
  }, [loadStatus, loadLogs]);

  useEffect(() => {
    void loadLogs();
  }, [filter, loadLogs]);

  // Còn việc đang chạy thì làm mới nhanh hơn để thấy tiến độ.
  const busyQueue = Boolean(status?.summary.some((s) => s.pending > 0));
  useEffect(() => {
    void loadStatus();
    const timer = window.setInterval(refresh, busyQueue ? 3_000 : 10_000);
    return () => window.clearInterval(timer);
  }, [loadStatus, refresh, busyQueue]);

  const act = async (key: string, fn: () => Promise<ActResult>) => {
    setBusy(key);
    try {
      const res = await fn();
      if (!res.ok) notification.error({ message: res.data.message || 'Thao tác thất bại.' });
      else notification.success({ message: res.data.message || 'Đã thực hiện.' });
      refresh();
    } catch {
      notification.error({ message: 'Không thể kết nối tới máy chủ.' });
    } finally {
      setBusy(null);
    }
  };

  const setF = (patch: Partial<SyncHistoryFilter>) => setFilter((f) => ({ ...f, ...patch, pageIndex: 1 }));

  return (
    <div className="ssoPanel ssoAppsAdmin">
      <div className="ssoPanel-headRow">
        <div>
          <h2>Đồng bộ ứng dụng</h2>
          <p className="ssoPanel-hint">
            Người dùng, tổ chức và nhóm quyền được đồng bộ tự động sang các ứng dụng. Thay đổi lỗi không chặn các
            thay đổi khác; sửa dữ liệu rồi bấm Thử lại, hoặc Bỏ qua nếu không cần gửi nữa.
          </p>
        </div>
        <Button icon={<ReloadOutlined />} onClick={() => refresh()}>
          Làm mới
        </Button>
      </div>

      {error && <Alert className="ssoAppsAdmin-alert" type="error" showIcon message="Không tải được trạng thái đồng bộ" />}
      {!status ? (
        <Skeleton active paragraph={{ rows: 4 }} />
      ) : (
        <Row gutter={[12, 12]}>
          {TARGETS.map((t) => {
            const enabled = status.enabled_targets.includes(t.key);
            const s = status.summary.find((x) => x.target === t.key);
            const pending = s?.pending ?? 0;
            const failed = s?.failed ?? 0;
            const headRetrying = Boolean(s?.head_attempts);
            return (
              <Col key={t.key} xs={24} sm={12} xl={6}>
                <Card
                  size="small"
                  title={t.label}
                  extra={enabled ? <Tag color="success">Bật</Tag> : <Tag>Tắt</Tag>}
                  style={{ height: '100%' }}
                >
                  <Space size={24}>
                    <Statistic title="Đang chờ" value={pending} />
                    <Statistic
                      title="Lỗi"
                      value={failed}
                      valueStyle={failed ? { color: 'var(--ant-color-error)' } : undefined}
                    />
                  </Space>
                  <div style={{ marginTop: 8, minHeight: 44 }}>
                    {headRetrying ? (
                      <Typography.Paragraph
                        type="warning"
                        style={{ marginBottom: 0 }}
                        ellipsis={{ rows: 3, tooltip: s?.head_error }}
                      >
                        Đang thử lại (lần {s?.head_attempts}, lần tới {fmt(s?.head_next_retry_at, 'HH:mm:ss')}):{' '}
                        {describeSyncError(s?.head_error ?? null, t.key)}
                      </Typography.Paragraph>
                    ) : pending > 0 ? (
                      <Typography.Text type="secondary">
                        <SyncOutlined spin /> Đang gửi {pending} thay đổi…
                      </Typography.Text>
                    ) : enabled ? (
                      <Typography.Text type="secondary">
                        Đã đồng bộ{s?.last_done_at ? ` · lần cuối ${fmt(s.last_done_at, 'HH:mm DD/MM')}` : ''}
                      </Typography.Text>
                    ) : (
                      <Typography.Text type="secondary">Chưa cấu hình secret hoặc đang tắt.</Typography.Text>
                    )}
                  </div>
                  <Space wrap style={{ marginTop: 12 }}>
                    <Tooltip title="Gửi lại ngay các thay đổi lỗi và thay đổi đang chờ thử lại">
                      <Button
                        size="small"
                        icon={<ThunderboltOutlined />}
                        disabled={!pending && !failed}
                        loading={busy === `retry-${t.key}`}
                        onClick={() => act(`retry-${t.key}`, () => retrySync({ target: t.key }))}
                      >
                        Thử lại ngay
                      </Button>
                    </Tooltip>
                    <Popconfirm
                      title={`Đồng bộ lại toàn bộ sang ${t.label}?`}
                      description="Gửi lại mọi người dùng, tổ chức, nhóm quyền hiện có."
                      okText="Đồng bộ"
                      cancelText="Huỷ"
                      disabled={!enabled}
                      onConfirm={() => act(`resync-${t.key}`, () => resyncTarget(t.key))}
                    >
                      <Button size="small" icon={<SyncOutlined />} disabled={!enabled} loading={busy === `resync-${t.key}`}>
                        Đồng bộ lại
                      </Button>
                    </Popconfirm>
                    <Popconfirm
                      title={`Bỏ qua mọi thay đổi đang chờ/lỗi của ${t.label}?`}
                      description="Các thay đổi này sẽ không được gửi nữa. Có thể Thử lại từng dòng trong nhật ký sau."
                      okText="Bỏ qua"
                      okButtonProps={{ danger: true }}
                      cancelText="Huỷ"
                      disabled={!pending && !failed}
                      onConfirm={() => act(`skip-${t.key}`, () => skipSync({ target: t.key }))}
                    >
                      <Button
                        size="small"
                        danger
                        icon={<StopOutlined />}
                        disabled={!pending && !failed}
                        loading={busy === `skip-${t.key}`}
                      >
                        Bỏ qua
                      </Button>
                    </Popconfirm>
                  </Space>
                </Card>
              </Col>
            );
          })}
        </Row>
      )}

      <div className="ssoPanel-headRow" style={{ marginTop: 24 }}>
        <h3 style={{ margin: 0 }}>Nhật ký đồng bộ</h3>
      </div>
      <div className="ssoSyncLog-filters">
        <Select
          allowClear
          placeholder="Ứng dụng"
          value={filter.target ?? undefined}
          onChange={(v) => setF({ target: v ?? null })}
          options={TARGETS.map((t) => ({ value: t.key, label: t.label }))}
        />
        <Select
          allowClear
          placeholder="Trạng thái"
          value={filter.status ?? undefined}
          onChange={(v) => setF({ status: v ?? null })}
          options={STATUSES.map((t) => ({ value: t.key, label: t.label }))}
        />
        <Select
          allowClear
          placeholder="Loại dữ liệu"
          value={filter.entity ?? undefined}
          onChange={(v) => setF({ entity: v ?? null })}
          options={ENTITIES.map((t) => ({ value: t.key, label: t.label }))}
        />
        <Input.Search
          allowClear
          placeholder="Tìm theo tên / mã"
          className="ssoSyncLog-search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onSearch={(v) => setF({ search: v.trim() || null })}
        />
        {selected.length > 0 && (
          <div className="ssoSyncLog-bulk">
            <Button
              icon={<ThunderboltOutlined />}
              loading={busy === 'retry-selected'}
              onClick={() => act('retry-selected', () => retrySync({ ids: selected }))}
            >
              Thử lại {selected.length} dòng
            </Button>
            <Popconfirm
              title={`Bỏ qua ${selected.length} dòng đã chọn?`}
              description="Chỉ áp dụng cho dòng đang chờ hoặc lỗi."
              okText="Bỏ qua"
              okButtonProps={{ danger: true }}
              cancelText="Huỷ"
              onConfirm={() => act('skip-selected', () => skipSync({ ids: selected }))}
            >
              <Button danger icon={<StopOutlined />} loading={busy === 'skip-selected'}>
                Bỏ qua {selected.length} dòng
              </Button>
            </Popconfirm>
          </div>
        )}
      </div>

      <Table<SyncLogRow>
        size="small"
        rowKey="id"
        loading={logsLoading}
        dataSource={logs}
        tableLayout="fixed"
        scroll={{ x: 720 }}
        locale={{ emptyText: 'Chưa có nhật ký đồng bộ' }}
        rowSelection={{
          selectedRowKeys: selected,
          onChange: (keys) => setSelected(keys as string[]),
          getCheckboxProps: (r) => ({ disabled: r.status === 'done' }),
        }}
        pagination={{
          current: filter.pageIndex,
          pageSize: filter.pageSize,
          total,
          showSizeChanger: true,
          pageSizeOptions: [20, 50, 100],
          showTotal: (n) => `${n} dòng`,
          onChange: (pageIndex, pageSize) => setFilter((f) => ({ ...f, pageIndex, pageSize })),
        }}
        columns={[
          {
            // Gộp ứng dụng + loại + mã + người thao tác vào 1 ô: khung panel hẹp,
            // tách cột riêng thì cột "Chi tiết" bị ép mất chỗ.
            title: 'Thay đổi',
            key: 'change',
            width: 250,
            render: (_, r) => (
              <div className="ssoSyncLog-cell">
                <Tooltip title={r.entity_id}>
                  <Typography.Text strong ellipsis style={{ maxWidth: '100%' }}>
                    {r.entity_label || r.entity_id}
                  </Typography.Text>
                </Tooltip>
                <Typography.Text type="secondary" className="ssoSyncLog-sub">
                  {targetLabel(r.target)} · {entityLabel(r.entity)} · {r.op === 'delete' ? 'Xoá' : 'Cập nhật'}
                </Typography.Text>
                <Typography.Text type="secondary" className="ssoSyncLog-sub">
                  #{r.id} · {r.created_by_name || (r.created_by ? r.created_by : 'Hệ thống')}
                </Typography.Text>
              </div>
            ),
          },
          {
            title: 'Trạng thái',
            key: 'status',
            width: 150,
            render: (_, r) => (
              <div className="ssoSyncLog-cell">
                <span>{statusTag(r)}</span>
                <Tooltip title={`Tạo: ${fmt(r.created_at)} · Cập nhật: ${fmt(r.updated_at)}`}>
                  <Typography.Text type="secondary" className="ssoSyncLog-sub">
                    {fmt(r.updated_at, 'DD/MM HH:mm:ss')}
                  </Typography.Text>
                </Tooltip>
                {r.attempts > 0 && (
                  <Typography.Text type="secondary" className="ssoSyncLog-sub">
                    Đã thử {r.attempts} lần
                  </Typography.Text>
                )}
              </div>
            ),
          },
          {
            title: 'Chi tiết',
            key: 'detail',
            render: (_, r) => {
              const text =
                r.status === 'done'
                  ? null
                  : describeSyncError(r.last_error, r.target) ?? (r.status === 'pending' ? 'Chờ gửi' : null);
              if (!text && !r.note) return <Typography.Text type="secondary">—</Typography.Text>;
              return (
                <div className="ssoSyncLog-cell">
                  {text && (
                    // Tooltip luôn hiện (không chỉ khi bị cắt chữ): diễn giải đầy
                    // đủ + lỗi gốc để báo kỹ thuật - thay cho cột mở rộng.
                    <Tooltip
                      title={
                        <div className="ssoSyncLog-tip">
                          <div>{text}</div>
                          {r.last_error && <code>{r.last_error}</code>}
                        </div>
                      }
                    >
                      <Typography.Paragraph
                        type={r.status === 'failed' ? 'danger' : r.status === 'pending' && r.attempts ? 'warning' : undefined}
                        ellipsis={{ rows: 3 }}
                        style={{ marginBottom: 0 }}
                      >
                        {text}
                      </Typography.Paragraph>
                    </Tooltip>
                  )}
                  {r.note && (
                    <Typography.Text type="secondary" className="ssoSyncLog-sub">
                      {r.note}
                    </Typography.Text>
                  )}
                </div>
              );
            },
          },
          {
            title: '',
            key: 'actions',
            width: 96,
            render: (_, r) =>
              r.status === 'done' ? null : (
                <div className="ssoSyncLog-actions">
                  <Button
                    size="small"
                    type="link"
                    loading={busy === `retry-row-${r.id}`}
                    onClick={() => act(`retry-row-${r.id}`, () => retrySync({ ids: [r.id] }))}
                  >
                    Thử lại
                  </Button>
                  {r.status !== 'skipped' && (
                    <Popconfirm
                      title="Bỏ qua thay đổi này?"
                      okText="Bỏ qua"
                      okButtonProps={{ danger: true }}
                      cancelText="Huỷ"
                      onConfirm={() => act(`skip-row-${r.id}`, () => skipSync({ ids: [r.id] }))}
                    >
                      <Button size="small" type="link" danger loading={busy === `skip-row-${r.id}`}>
                        Bỏ qua
                      </Button>
                    </Popconfirm>
                  )}
                </div>
              ),
          },
        ]}
      />
    </div>
  );
}
