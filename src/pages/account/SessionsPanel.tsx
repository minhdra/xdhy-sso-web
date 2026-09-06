import { LaptopOutlined } from '@ant-design/icons';
import { App as AntdApp, Button, List, Spin, Tag } from 'antd';
import { useEffect, useState } from 'react';

import { getSessions, revokeSessionRequest, type SsoSession } from '../../api';

// Parse gọn user-agent -> "Chrome · macOS" (không cần thư viện).
function describeAgent(ua: string | null): string {
  if (!ua) return 'Không rõ thiết bị';
  const browser =
    /Edg\//.test(ua) ? 'Edge'
    : /OPR\//.test(ua) ? 'Opera'
    : /Chrome\//.test(ua) ? 'Chrome'
    : /Firefox\//.test(ua) ? 'Firefox'
    : /Safari\//.test(ua) ? 'Safari'
    : /curl\//.test(ua) ? 'curl'
    : 'Trình duyệt khác';
  const os =
    /Windows/.test(ua) ? 'Windows'
    : /Mac OS X|Macintosh/.test(ua) ? 'macOS'
    : /Android/.test(ua) ? 'Android'
    : /iPhone|iPad|iOS/.test(ua) ? 'iOS'
    : /Linux/.test(ua) ? 'Linux'
    : '';
  return os ? `${browser} · ${os}` : browser;
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.round(diff / 60000);
  if (min < 1) return 'vừa xong';
  if (min < 60) return `${min} phút trước`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr} giờ trước`;
  return `${Math.round(hr / 24)} ngày trước`;
}

export default function SessionsPanel() {
  const { notification, modal } = AntdApp.useApp();
  const [sessions, setSessions] = useState<SsoSession[] | null>(null);
  const [revoking, setRevoking] = useState<string | null>(null);

  const load = () => {
    getSessions()
      .then((res) => setSessions(res.ok ? res.data : []))
      .catch(() => {
        notification.error({ message: 'Không tải được danh sách phiên.' });
        setSessions([]);
      });
  };

  useEffect(load, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleRevoke = (s: SsoSession) => {
    modal.confirm({
      title: 'Thu hồi phiên này?',
      content: `${describeAgent(s.user_agent)} — ${s.ip ?? 'IP không rõ'}. Thiết bị đó sẽ phải đăng nhập lại.`,
      okText: 'Thu hồi',
      okButtonProps: { danger: true },
      cancelText: 'Huỷ',
      onOk: async () => {
        setRevoking(s.session_id);
        try {
          const res = await revokeSessionRequest(s.session_id);
          if (!res.ok) {
            notification.error({ message: res.data.message || 'Không thu hồi được.' });
            return;
          }
          notification.success({ message: 'Đã thu hồi phiên.' });
          load();
        } catch {
          notification.error({ message: 'Lỗi kết nối tới server.' });
        } finally {
          setRevoking(null);
        }
      },
    });
  };

  if (sessions === null) {
    return (
      <div className="ssoPanel">
        <Spin />
      </div>
    );
  }

  const groups = Array.from(
    sessions.reduce((result, session) => {
      const agent = describeAgent(session.user_agent);
      const current = result.get(agent) ?? [];
      current.push(session);
      result.set(agent, current);
      return result;
    }, new Map<string, SsoSession[]>()),
  ).sort(([, left], [, right]) => Number(right.some((s) => s.current)) - Number(left.some((s) => s.current)));

  return (
    <div className="ssoPanel">
      <h2>Phiên đăng nhập</h2>
      <p className="ssoPanel-hint" style={{ marginTop: 0 }}>
        Các thiết bị đang đăng nhập vào tài khoản của bạn.
      </p>

      <div className="ssoSessionGroups">
        {groups.map(([agent, agentSessions]) => (
          <section className="ssoSessionGroup" key={agent}>
            <header className="ssoSessionGroup-header">
              <span className="ssoSessionGroup-icon"><LaptopOutlined /></span>
              <span>
                <strong>{agent}</strong>
                <small>{agentSessions.length} phiên đăng nhập</small>
              </span>
            </header>
            <List
              dataSource={agentSessions}
              renderItem={(s) => (
                <List.Item
                  actions={
                    s.current
                      ? []
                      : [
                          <Button
                            key="revoke"
                            danger
                            size="small"
                            loading={revoking === s.session_id}
                            onClick={() => handleRevoke(s)}
                          >
                            Thu hồi
                          </Button>,
                        ]
                  }
                >
                  <List.Item.Meta
                    title={
                      <>
                        {s.ip ?? 'IP không rõ'}{' '}
                        {s.current && <Tag color="blue">Phiên này</Tag>}
                        {s.remember && <Tag>Ghi nhớ</Tag>}
                      </>
                    }
                    description={`Hoạt động ${relativeTime(s.last_seen_at)}`}
                  />
                </List.Item>
              )}
            />
          </section>
        ))}
      </div>
    </div>
  );
}
