import { ReloadOutlined, SyncOutlined } from '@ant-design/icons';
import { Alert, App as AntdApp, Button, Card, Col, Popconfirm, Row, Skeleton, Space, Statistic, Table, Tag, Typography } from 'antd';
import dayjs from 'dayjs';
import { useCallback, useEffect, useState } from 'react';

import { getSyncStatus, resyncTarget, retrySync, type SyncStatus, type SyncTarget } from '../../api';

const TARGETS: { key: SyncTarget; label: string }[] = [
  { key: 'finance', label: 'Tài chính' },
  { key: 'task', label: 'Công việc' },
  { key: 'chat', label: 'Chat' },
  { key: 'meeting', label: 'Họp' },
];
const label = (t: string) => TARGETS.find((x) => x.key === t)?.label ?? t;

// Trạng thái đồng bộ SSO -> ứng dụng (hàng đợi a_sync_outbox). Mục "lỗi" là
// thay đổi đã thử gửi nhiều lần không được - bấm Thử lại sau khi ứng dụng đích
// chạy lại; "Đồng bộ lại toàn bộ" đẩy lại mọi dữ liệu hiện có (đối soát).
export default function SyncAdminPanel() {
  const { notification } = AntdApp.useApp();
  const [status, setStatus] = useState<SyncStatus | null>(null);
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(false);
    try {
      const res = await getSyncStatus();
      if (!res.ok) throw new Error(res.data.message);
      setStatus(res.data);
    } catch {
      setError(true);
    }
  }, []);
  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(), 10_000);
    return () => window.clearInterval(timer);
  }, [load]);

  const act = async (key: string, fn: () => Promise<{ ok: boolean; data: { message?: string } }>) => {
    setBusy(key);
    try {
      const res = await fn();
      if (!res.ok) notification.error({ message: res.data.message || 'Thao tác thất bại.' });
      else notification.success({ message: res.data.message || 'Đã thực hiện.' });
      void load();
    } catch {
      notification.error({ message: 'Không thể kết nối tới máy chủ.' });
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="ssoPanel ssoAppsAdmin">
      <div className="ssoPanel-headRow">
        <div>
          <h2>Đồng bộ ứng dụng</h2>
          <p className="ssoPanel-hint">
            Người dùng, tổ chức và nhóm quyền được đồng bộ tự động sang các ứng dụng. Tự làm mới mỗi 10 giây.
          </p>
        </div>
        <Button icon={<ReloadOutlined />} onClick={() => void load()}>
          Làm mới
        </Button>
      </div>

      {error && <Alert className="ssoAppsAdmin-alert" type="error" showIcon message="Không tải được trạng thái đồng bộ" />}
      {!status ? (
        <Skeleton active paragraph={{ rows: 4 }} />
      ) : (
        <>
          <Row gutter={[12, 12]}>
            {TARGETS.map((t) => {
              const enabled = status.enabled_targets.includes(t.key);
              const s = status.summary.find((x) => x.target === t.key);
              return (
                <Col key={t.key} xs={24} sm={12} xl={6}>
                  <Card
                    size="small"
                    title={t.label}
                    extra={enabled ? <Tag color="success">Bật</Tag> : <Tag>Tắt</Tag>}
                  >
                    <Space size={24}>
                      <Statistic title="Đang chờ" value={s?.pending ?? 0} />
                      <Statistic
                        title="Lỗi"
                        value={s?.failed ?? 0}
                        valueStyle={s?.failed ? { color: 'var(--ant-color-error)' } : undefined}
                      />
                    </Space>
                    {s?.last_error && (
                      <Typography.Paragraph type="danger" ellipsis={{ rows: 2, tooltip: s.last_error }} style={{ marginTop: 8, marginBottom: 0 }}>
                        {s.last_error}
                      </Typography.Paragraph>
                    )}
                    <Space wrap style={{ marginTop: 12 }}>
                      <Button
                        size="small"
                        disabled={!s?.failed}
                        loading={busy === `retry-${t.key}`}
                        onClick={() => act(`retry-${t.key}`, () => retrySync(t.key))}
                      >
                        Thử lại lỗi
                      </Button>
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
                    </Space>
                  </Card>
                </Col>
              );
            })}
          </Row>

          <h3 style={{ marginTop: 20 }}>Thay đổi lỗi</h3>
          <Table
            size="small"
            rowKey="id"
            dataSource={status.failed}
            pagination={{ pageSize: 10, hideOnSinglePage: true }}
            scroll={{ x: 640 }}
            locale={{ emptyText: 'Không có thay đổi lỗi' }}
            columns={[
              { title: 'Ứng dụng', dataIndex: 'target', width: 110, render: (t: string) => label(t) },
              { title: 'Loại', dataIndex: 'entity', width: 110 },
              { title: 'Mã', dataIndex: 'entity_id', ellipsis: true, responsive: ['md'] },
              { title: 'Số lần', dataIndex: 'attempts', width: 80 },
              { title: 'Lỗi', dataIndex: 'last_error', ellipsis: true },
              {
                title: 'Lúc',
                dataIndex: 'updated_at',
                width: 130,
                responsive: ['lg'],
                render: (v: string) => dayjs(v).format('DD/MM HH:mm'),
              },
            ]}
          />
        </>
      )}
    </div>
  );
}
