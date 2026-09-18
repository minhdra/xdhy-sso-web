// Loading toàn trang - cùng animation Lottie (cẩu/gạch) đã dùng ở build-web
// (src/modules/shared/loading/PageLoading.tsx), thay cho antd <Spin> trần
// trước đây ở RequireAuth để đồng bộ trải nghiệm giữa các app trong hệ SSO.
// Component RIÊNG (không inline trong RequireAuth) để hook lottie mount/
// unmount đúng theo vòng đời của chính nó - render điều kiện (loading -> nội
// dung thật) nếu animation nằm chung effect với component cha thì lúc
// chuyển nhánh render, container bị gỡ khỏi DOM nhưng effect (deps []) không
// chạy lại nên không destroy() được - rò lottie instance chạy nền vô thời hạn.
import lottie from 'lottie-web/build/player/lottie_light';
import { useEffect, useRef, useState } from 'react';

import loadingPage from '../assets/loading-page.json';

export function PageLoading() {
  const ref = useRef<HTMLDivElement>(null);
  const [isSlow, setIsSlow] = useState(false);

  useEffect(() => {
    if (!ref.current) return;
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const anim = lottie.loadAnimation({
      container: ref.current,
      renderer: 'svg',
      loop: !reduceMotion,
      autoplay: !reduceMotion,
      animationData: loadingPage,
    });
    if (reduceMotion) anim.goToAndStop(0, true);
    return () => anim.destroy();
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => setIsSlow(true), 4000);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <div className="sessionLoading" aria-live="polite">
      {/* Khối cẩu/gạch trong loading-page.json không nằm giữa khung 500x500
          của chính nó (đã đo ở build-web) - bù lệch bằng dịch trái ~5.8% bề
          rộng chính nó, xem PageLoading.module.scss bên build-web. */}
      <div
        ref={ref}
        className="page-loading-icon"
        style={{ width: 180, height: 180, transform: 'translateX(-5.8%)' }}
      />
      <div className="sessionLoading-copy">
        <strong>Đang kiểm tra phiên đăng nhập</strong>
        <span>{isSlow ? 'Kết nối đang chậm hơn bình thường…' : 'Vui lòng chờ trong giây lát.'}</span>
      </div>
    </div>
  );
}
