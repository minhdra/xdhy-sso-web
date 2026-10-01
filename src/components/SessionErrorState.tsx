import { Button, Result, Space, Typography } from 'antd';

import { type SessionError } from '../store/session';

interface Props {
  error: SessionError | null;
  onRetry: () => void;
}

export function SessionErrorState({ error, onRetry }: Props) {
  return (
    <main className="sessionState" aria-live="polite">
      <Result
        status="warning"
        title="Chưa thể kết nối hệ thống"
        subTitle={error?.message ?? 'Không thể kiểm tra phiên đăng nhập.'}
        extra={
          <Space wrap>
            <Button type="primary" onClick={onRetry}>
              Thử lại
            </Button>
            <Button href="/login">Đăng nhập lại</Button>
          </Space>
        }
      >
        <Typography.Text type="secondary">
          Kiểm tra kết nối mạng hoặc thử lại sau ít phút. Phiên của bạn chưa bị đăng xuất.
        </Typography.Text>
      </Result>
    </main>
  );
}
