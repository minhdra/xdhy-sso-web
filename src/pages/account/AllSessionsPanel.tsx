import { StopOutlined } from '@ant-design/icons';
import { App as AntdApp, Button, Empty, Input, Popconfirm, Space, Table, Tag } from 'antd';
import { type ReactNode, useCallback, useEffect, useState } from 'react';

import {
  type AdminSessionUser,
  adminRevokeSession,
  adminRevokeUserSessions,
  getAdminSessions,
  type SsoSession,
} from '../../api';
import { useSessionStore } from '../../store/session';
import { describeAgent, displayIp, relativeTime } from './SessionsPanel';
import { TABLE_SCROLL_Y } from '../../tableScroll';

const PAGE_SIZE = 20;

// Quản trị: người đang có phiên đăng nhập, gom theo người - bấm mở rộng để xem
// từng phiên và thu hồi (20/10/2026). BE chặn thu hồi phiên hiện tại và tài
// khoản của chính mình - nút bị ẩn tương ứng.
export default function AllSessionsPanel({ toolbar }: { toolbar?: ReactNode }) {
  const { notification } = AntdApp.useApp();
  const myUserName = useSessionStore((st) => st.user?.user_name);
  const [rows, setRows] = useState<AdminSessionUser[]>([]);
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

  const sessionRows = (user: AdminSessionUser) => (
    <Table<SsoSession>
      rowKey="session_id"
      size="small"
      pagination={false}
      dataSource={user.sessions}
      columns={[
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
          width: 100,
          render: (_, s) =>
            s.current ? null : (
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
            ),
        },
      ]}
    />
  );

  return (
    <div className="ssoPanel ssoAppsAdmin">
      <div className="ssoPanel-headRow">
        <div>
          <h2>Phiên đăng nhập của mọi người</h2>
          <p className="ssoPanel-hint" style={{ marginTop: 0 }}>
            Gom theo người. Bấm vào dấu mũi tên để xem từng phiên; thu hồi một phiên thì thiết bị đó phải đăng nhập lại.
          </p>
        </div>
        {toolbar}
      </div>
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
      <Table<AdminSessionUser>
        rowKey="user_id"
        loading={loading}
        dataSource={rows}
        scroll={{ x: 560, y: TABLE_SCROLL_Y }}
        locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Không có phiên nào" /> }}
        pagination={{ current: page, pageSize: PAGE_SIZE, total, showSizeChanger: false, onChange: setPage }}
        expandable={{ expandedRowRender: sessionRows, rowExpandable: (u) => u.sessions.length > 0 }}
        columns={[
          {
            title: 'Người dùng',
            key: 'user',
            render: (_, u) => (
              <div>
                <strong>{u.full_name || u.user_name}</strong>
                <div style={{ fontSize: 12, opacity: 0.65 }}>{u.user_name}</div>
              </div>
            ),
          },
          { title: 'Số phiên', dataIndex: 'session_count', key: 'count', width: 100 },
          { title: 'Hoạt động gần nhất', key: 'seen', width: 170, render: (_, u) => relativeTime(u.last_seen_at) },
          {
            title: '',
            key: 'actions',
            width: 150,
            fixed: 'right',
            render: (_, u) =>
              u.user_name === myUserName ? null : (
                <Popconfirm
                  title="Thu hồi mọi phiên của người này?"
                  description={`${u.full_name || u.user_name} sẽ phải đăng nhập lại ở mọi thiết bị.`}
                  okText="Thu hồi tất cả"
                  cancelText="Huỷ"
                  okButtonProps={{ danger: true }}
                  onConfirm={() => run(`u:${u.user_id}`, () => adminRevokeUserSessions(u.user_id))}
                >
                  <Button size="small" danger icon={<StopOutlined />} loading={busy === `u:${u.user_id}`}>
                    Thu hồi tất cả
                  </Button>
                </Popconfirm>
              ),
          },
        ]}
      />
    </div>
  );
}
