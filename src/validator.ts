import { type FormRule } from 'antd';

// Rút gọn từ build-web/src/utils/validator.ts (RULES_FORM) - chỉ giữ 2 rule
// trang login thật sự cần, giữ nguyên message để nhất quán UX.
export const RULES_FORM = {
  required: [
    {
      required: true,
      transform: (value) => (typeof value === 'string' ? value.trim() : value),
      message: 'Không thể để trống',
    },
  ] satisfies FormRule[],
  email: [
    {
      pattern: /^[\w.-]+@[\w-]+(\.[\w-]+)+$/,
      message: 'Email không đúng định dạng',
    },
  ] satisfies FormRule[],
  // Khớp đúng điều kiện backend check (authController.resetPasswordConfirm:
  // newPassword.length < 6 -> 400) - validate trước ở FE cho UX tốt hơn,
  // không thay cho check ở backend.
  passwordMin: [
    {
      min: 6,
      message: 'Mật khẩu phải có ít nhất 6 ký tự',
    },
  ] satisfies FormRule[],
};
