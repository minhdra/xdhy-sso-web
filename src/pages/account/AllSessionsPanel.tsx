import { StopOutlined } from '@ant-design/icons';
import { App as AntdApp, Button, Empty, Input, Popconfirm, Space, Table, Tag } from 'antd';
import { useCallback, useEffect, useState } from 'react';

import { type AdminSession, adminRevokeSession, adminRevokeUserSessions, getAdminSessions } from '../../api';
import { useSessionStore } from '../../store/session';
import { describeAgent, displayIp, relativeTime } from './SessionsPanel';

const PAGE_SIZE = 20;

// Quản trị: phiên đăng nhập đang hoạt động của mọi người (20/10/2026). BE chặn
// thu hồi phiên hiện tại và tài khoản của chính mình - nút bị ẩn tương ứng.
export default function AllSessionsPanel() {
  const { notification } = AntdApp.useApp();
  const myUserName = useSessionStore((st) => st.user?.user_name);
  const [rows, setRows] = useState<AdminSession[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState('');
  const [keyword, setKeyword] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getAdminSessions({ q, page, page_size: PAGE_SIZE });
      if (res.ok) {
        setRows(res.data.items);
        setTotal(res.data.total);
      } else {
        notification.error({ message: res.data.message || 'Không tải được danh sách phiên.' });
      }
    } catch {
      notification.error({ message: 'Không thể kết nối tới máy chủ.' });
    } finally {
      setLoading(false);
    }
  }, [q, page, notification]);

  useEffect(() => {
    void load();
  }, [load]);

  const run = async (key: string, action: () => ReturnType<typeof adminRevokeSession>) => {
    setBusy(key);
    try {
      const res = await action();
      if (!res.ok) {
        notification.error({ message: res.data.message || 'Không thu hồi được.' });
        return;
      }
      notification.success({ message: res.data.message || 'Đã thu hồi.' });
      await load();
    } catch {
      notification.error({ message: 'Không thể kết nối tới máy chủ.' });
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="ssoPanel ssoAppsAdmin">
      <h2>Phiên đăng nhập của mọi người</h2>
      <p className="ssoPanel-hint" style={{ marginTop: 0 }}>
        Các phiên đang hoạt động. Thu hồi một phiên thì thiết bị đó phải đăng nhập lại.
      </p>
      <Space style={{ marginBottom: 12 }}>
        <Input.Search
          allowClear
          placeholder="Tìm theo tên đăng nhập, họ tên hoặc IP"
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          onSearch={(v) => {
            setPage(1);
            setQ(v.trim());
          }}
          style={{ width: 320 }}
          maxLength={100}
        />
      </Space>
      <Table<AdminSession>
        rowKey="session_id"
        loading={loading}
        dataSource={rows}
        scroll={{ x: 760 }}
        locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Không có phiên nào" /> }}
        pagination={{ current: page, pageSize: PAGE_SIZE, total, showSizeChanger: false, onChange: setPage }}
        columns={[
          {
            title: 'Người dùng',
            key: 'user',
            render: (_, s) => (
              <div>
                <strong>{s.full_name || s.user_name}</strong>
                <div style={{ fontSize: 12, opacity: 0.65 }}>{s.user_name}</div>
              </div>
            ),
          },
          {
            title: 'Thiết bị',
            key: 'device',
            render: (_, s) => (
              <>
                {describeAgent(s.user_agent)} {s.current && <Tag color="blue">Phiên này</Tag>}
                {s.remember && <Tag>Ghi nhớ</Tag>}
              </>
            ),
          },
          { title: 'IP', key: 'ip', width: 140, render: (_, s) => displayIp(s.ip) },
          { title: 'Hoạt động', key: 'seen', width: 130, render: (_, s) => relativeTime(s.last_seen_at) },
          {
            title: '',
            key: 'actions',
            width: 190,
            fixed: 'right',
            render: (_, s) => (
              <Space size={4}>
                {!s.current && (
                  <Popconfirm
                    title="Thu hồi phiên này?"
                    description={`${describeAgent(s.user_agent)} — ${displayIp(s.ip)}`}
                    okText="Thu hồi"
                    cancelText="Huỷ"
                    okButtonProps={{ danger: true }}
                    onConfirm={() => run(s.session_id, () => adminRevokeSession(s.session_id))}
                  >
                    <Button size="small" danger loading={busy === s.session_id}>
                      Thu hồi
                    </Button>
                  </Popconfirm>
                )}
                {s.user_name !== myUserName && (
                <Popconfirm
                  title="Thu hồi mọi phiên của người này?"
                  description={`${s.full_name || s.user_name} sẽ phải đăng nhập lại ở mọi thiết bị.`}
                  okText="Thu hồi tất cả"
                  cancelText="Huỷ"
                  okButtonProps={{ danger: true }}
                  onConfirm={() => run(`u:${s.user_id}`, () => adminRevokeUserSessions(s.user_id))}
                >
                  <Button size="small" icon={<StopOutlined />} loading={busy === `u:${s.user_id}`}>
                    Tất cả
                  </Button>
                </Popconfirm>
                )}
              </Space>
            ),
          },
        ]}
      />
    </div>
  );
}
