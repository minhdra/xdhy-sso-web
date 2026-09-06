# Database

`sso-web` **không có database riêng** — đây là frontend thuần, mọi dữ liệu lấy qua gọi API (xem
[`api.md`](./api.md)), không kết nối trực tiếp Postgres/bất kỳ DB nào. Không có ORM, migration, hay
connection string nào trong repo này.

Schema thật (bảng, cột, stored procedure) sống ở phía backend:

- [`../../api-sso/docs/database.md`](../../api-sso/docs/database.md) — bảng/proc module SSO
  (`a_session`, `a_refresh_token`, `a_password_reset_token`, `a_app`, `a_app_access`) + bảng dùng chung
  đọc lại (`system_users`, `user_profiles`, `employee`, `positions`, `department`, `branch`, `roles`).
- [`../../build-web/docs/database.md`](../../build-web/docs/database.md) — schema module task/tài
  chính (không liên quan trực tiếp `sso-web`, tham khảo nếu cần hiểu app đích mà trang chủ trỏ tới).

## Shape dữ liệu FE kỳ vọng (từ `src/api.ts`)

Không phải schema DB thật — type FE tự khai theo response API đang nhận, có thể lệch nếu backend đổi
mà chưa cập nhật type ở đây. Các type trung tâm: `Me` (kết quả `/me`), `AccountProfile` (kết quả
`/account/profile`, nhiều field hơn `Me` — thêm `department_name`/`branch_name`/`type`), `SsoApp`/
`AdminApp` (danh sách app), `SsoSession` (phiên đăng nhập) — xem định nghĩa đầy đủ trong
[`src/api.ts`](../src/api.ts), không lặp lại field-by-field ở đây (dễ lệch, nguồn thật luôn là code).
