import { type FormRule } from 'antd';
import type dayjs from 'dayjs';

// Quy tắc kiểm tra form dùng chung (sso-web). Giữ message giống task-web/build-web
// (src/utils/validator.ts bên đó). Giới hạn độ dài/định dạng phải KHỚP schema
// backend (api-sso/src/schemas/*.schema.ts) - không nới lỏng hơn.
// KHÔNG dùng flag "g" trong pattern (RegExp giữ lastIndex -> validate sai lần 2).
export const RULES_FORM = {
  required: [
    {
      required: true,
      transform: (value) => (typeof value === 'string' ? value.trim() : value),
      message: 'Không thể để trống',
    },
  ] satisfies FormRule[],
  // Text tự do (tên, địa chỉ, mô tả...): không khoảng trắng đầu/cuối, không
  // nhiều khoảng trắng liên tiếp, không ký tự lạ.
  text: [
    { pattern: /^(?!\s)[\s\S]*(?<!\s)$/, message: 'Không để khoảng trắng đầu/cuối' },
    { pattern: /^(?![\s\S]*[^\S\n]{2,})[\s\S]*$/, message: 'Không nhiều khoảng trắng liên tiếp' },
    { pattern: /^(?![\s\S]*[<>{}[\]\\`~])[\s\S]*$/, message: 'Không chứa ký tự < > { } [ ] \\ ` ~' },
  ] satisfies FormRule[],
  // Họ tên người: chỉ chữ (có dấu) và khoảng trắng.
  personName: [
    { pattern: /^[\p{L}]+( [\p{L}]+)*$/u, message: 'Họ tên chỉ gồm chữ cái, cách nhau 1 khoảng trắng' },
    { min: 2, message: 'Họ tên ít nhất 2 ký tự' },
    { max: 60, message: 'Họ tên tối đa 60 ký tự' },
  ] satisfies FormRule[],
  email: [
    {
      pattern: /^[\w.+-]+@[\w-]+(\.[\w-]+)+$/,
      message: 'Email không đúng định dạng',
    },
    { max: 150, message: 'Email tối đa 150 ký tự' },
  ] satisfies FormRule[],
  // Số di động VN: 10 số, bắt đầu bằng 0 (khớp backend).
  phone: [
    {
      pattern: /^0\d{9}$/,
      message: 'Số điện thoại phải có 10 số và bắt đầu bằng 0',
    },
  ] satisfies FormRule[],
  // Điện thoại bàn/fax của chi nhánh, phòng ban: số, khoảng trắng, + ( ) . -
  landline: [
    { pattern: /^[0-9+()\s.-]{6,20}$/, message: 'Chỉ gồm số và + ( ) . - (6–20 ký tự)' },
  ] satisfies FormRule[],
  // Tên đăng nhập: chữ thường không dấu, số, . _ -
  userName: [
    { pattern: /^[a-z0-9._-]+$/, message: 'Chỉ chữ thường không dấu, số và . _ -' },
    { min: 3, message: 'Tối thiểu 3 ký tự' },
    { max: 50, message: 'Tối đa 50 ký tự' },
  ] satisfies FormRule[],
  // Mã (nhóm quyền...): chữ, số, _ -
  code: [
    { pattern: /^[A-Za-z0-9_-]+$/, message: 'Chỉ gồm chữ, số, "_" và "-"' },
  ] satisfies FormRule[],
  // Ngày sinh: không ở tương lai, không trước 1900.
  birthDate: [
    {
      validator: async (_: unknown, value?: dayjs.Dayjs | null) => {
        if (!value) return;
        if (value.isAfter(new Date(), 'day')) throw new Error('Ngày sinh không được ở tương lai');
        if (value.year() < 1900) throw new Error('Ngày sinh không hợp lệ');
      },
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

export const maxLen = (n: number): FormRule => ({ max: n, message: `Tối đa ${n} ký tự` });

// Viết hoa chữ cái đầu mỗi từ, còn lại viết thường ("giang VĂN cốt" ->
// "Giang Văn Cốt"). Dùng làm `normalize` của Form.Item họ tên - áp ngay khi gõ.
export const capitalizeName = (value?: string): string =>
  (value ?? '').toLocaleLowerCase('vi').replace(/(^|\s)(\p{L})/gu, (_m, sep: string, ch: string) => sep + ch.toLocaleUpperCase('vi'));
