import { useBrandingStore } from '../store/branding';

// Tên viết tắt cạnh logo (tuỳ chọn show_short_name ở tab Thương hiệu). Dùng chung
// cho header và trang đăng nhập/đặt lại mật khẩu - kiểu chữ ở .brandName.
export function BrandName() {
  const branding = useBrandingStore((s) => s.branding);
  if (!branding.show_short_name) return null;
  return <span className="brandName">{branding.short_name}</span>;
}
