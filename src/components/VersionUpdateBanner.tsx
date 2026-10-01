import { Alert, Button } from 'antd';
import { useCallback, useEffect, useRef, useState } from 'react';

import { recordDiagnostic } from '../diagnostics';
import { getServerVersion, recordVersionCheckFailure } from '../version';

const CHECK_INTERVAL_MS = 5 * 60 * 1000;

export function VersionUpdateBanner() {
  const [newBuildId, setNewBuildId] = useState<string | null>(null);
  const checkingRef = useRef(false);

  const checkVersion = useCallback(async () => {
    if (checkingRef.current) return;
    checkingRef.current = true;
    try {
      const server = await getServerVersion();
      if (server.buildId !== __APP_BUILD_INFO__.buildId) {
        setNewBuildId(server.buildId);
        recordDiagnostic('new_version_available', { detail: server.buildId });
      }
    } catch (error) {
      recordVersionCheckFailure(error);
    } finally {
      checkingRef.current = false;
    }
  }, []);

  useEffect(() => {
    const interval = window.setInterval(() => void checkVersion(), CHECK_INTERVAL_MS);
    const onVisible = () => {
      if (document.visibilityState === 'visible') void checkVersion();
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', checkVersion);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', checkVersion);
    };
  }, [checkVersion]);

  if (!newBuildId) return null;

  return (
    <Alert
      className="version-update-banner"
      type="info"
      showIcon
      banner
      message="Đã có phiên bản mới"
      description="Cập nhật khi bạn đã lưu xong nội dung đang chỉnh sửa."
      action={
        <Button size="small" type="primary" onClick={() => window.location.reload()}>
          Cập nhật ngay
        </Button>
      }
      closable
      onClose={() => setNewBuildId(null)}
    />
  );
}

