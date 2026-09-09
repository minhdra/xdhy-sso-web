import { LaptopOutlined } from '@ant-design/icons';
import { App as AntdApp, Button, List, Spin, Tag } from 'antd';
import { useEffect, useState } from 'react';

import { getSessions, revokeSessionRequest, type SsoSession } from '../../api';

// Parse gọn user-agent -> "Chrome · macOS" (không cần thư viện).
function describeAgent(ua: string | null): string {
  if (!ua) return 'Không rõ thiết bị';

  // OS: iOS PHẢI check trước macOS - mọi UA iOS đều chứa "like Mac OS X".
  const os =
    /iPhone|iPad|iPod/.test(ua) ? 'iOS'
    : /Android/.test(ua) ? 'Android'
    : /Windows NT/.test(ua) ? 'Windows'
    : /CrOS/.test(ua) ? 'ChromeOS'
    : /Mac OS X|Macintosh/.test(ua) ? 'macOS'
    : /Linux/.test(ua) ? 'Linux'
    : '';

  // Webview app trong ứng dụng (Zalo, Facebook, IG, LINE) không có token
  // "Safari/" -> check trước các trình duyệt thường. Electron trước Chrome.
  const browser =
    /Zalo/i.test(ua) ? 'Zalo'
    : /FBAN|FBAV|FB_IAB/.test(ua) ? 'Facebook'
    : /Instagram/i.test(ua) ? 'Instagram'
    : /\bLine\//i.test(ua) ? 'LINE'
    : /Code\/[\d.]+ /.test(ua) ? 'VS Code'
    : /Electron\//.test(ua) ? 'Ứng dụng desktop'
    : /Edg(A|iOS)?\//.test(ua) ? 'Edge'
    : /OPR\/|OPiOS\//.test(ua) ? 'Opera'
    : /SamsungBrowser\//.test(ua) ? 'Samsung Internet'
    : /Firefox\/|FxiOS\//.test(ua) ? 'Firefox'
    : /CriOS\/|Chrome\//.test(ua) ? 'Chrome'
    : /curl\//.test(ua) ? 'curl'
    : /Version\/[\d.]+.*Safari\/|Safari\//.test(ua) ? 'Safari'
    : 'Trình duyệt khác';

  return os ? `${browser} · ${os}` : browser;
}

function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return 'không rõ';
  const diff = Date.now() - then;
  // diff < 30s (gồm cả lệch nhỏ về "tương lai") -> vừa xong.
  if (diff < 30_000) return 'vừa xong';
  const min = Math.round(diff / 60000);
  if (min < 60) return `${min} phút trước`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr} giờ trước`;
  const day = Math.round(hr / 24);
  if (day < 30) return `${day} ngày trước`;
  return `${Math.round(day / 30)} tháng trước`;
}

// Cột `ip` có thể kèm ":port" (117.7.137.54:57741) do IIS/ARR - bỏ khi hiển
// thị. IPv6 trần (nhiều dấu ":") giữ nguyên; loopback gọi là "localhost".
function displayIp(ip: string | null): string {
  if (!ip) return 'IP không rõ';
  if (ip === '::1' || ip === '127.0.0.1' || ip === '::ffff:127.0.0.1') return 'localhost';
  const mapped = ip.match(/^::ffff:(\d{1,3}(?:\.\d{1,3}){3})(?::\d+)?$/i);
  if (mapped) return mapped[1];
  if (ip.startsWith('[')) {
    const end = ip.indexOf(']');
    return end > 0 ? ip.slice(1, end) : ip;
  }
  const parts = ip.split(':');
  return parts.length === 2 ? parts[0] : ip;
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
      content: `${describeAgent(s.user_agent)} — ${displayIp(s.ip)}. Thiết bị đó sẽ phải đăng nhập lại.`,
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
                        {displayIp(s.ip)}{' '}
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
