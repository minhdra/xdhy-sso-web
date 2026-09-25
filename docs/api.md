# API

`sso-web` **không sở hữu API nào** — mọi hàm gọi API nằm trong 1 file duy nhất
[`src/api.ts`](../src/api.ts), tất cả qua `request()` dùng chung (base URL = `/api/api-sso`, same-origin qua
nginx proxy của chính `sso-web` (dev qua vite `server.proxy`) — `VITE_BASE_URL` luôn là `/api`, giống
`build-web`/`task-web`;
`credentials: 'include'` để cookie httpOnly đi kèm). Nguồn sự thật cho request/response thật: Swagger
của `api-sso` (`GET /api/docs/api-sso/` qua gateway) — xem
[`api-sso/docs/api.md`](../../api-sso/docs/api.md) để có bảng endpoint đầy đủ. File này chỉ liệt kê
`sso-web` gọi hàm nào ở đâu.

## Mapping hàm → endpoint

| Hàm (`api.ts`) | Endpoint | Dùng ở |
| --- | --- | --- |
| `loginRequest` | `POST /login` | `pages/LoginPage.tsx` |
| `refreshRequest` | `POST /refresh` | khai sẵn, hiện chưa có nơi gọi tự động (xem `architecture.md` mục Auth flow — chưa có interceptor refresh) |
| `logoutRequest` | `POST /logout` | `components/AppHeader.tsx` |
| `forgotPasswordRequest` | `POST /forgot-password` | `pages/LoginPage.tsx` (view "Quên mật khẩu") |
| `resetPasswordConfirmRequest` | `POST /reset-password-confirm` | `pages/ResetPasswordPage.tsx` |
| `getMe` | `GET /me` | `store/session.ts` (`fetchMe`) |
| `getProfile` | `GET /account/profile` | `pages/account/ProfilePanel.tsx` (cắt vuông 400 × 400, ưu tiên WebP trước khi upload) |
| `updateProfileRequest` | `PUT /account/profile` | `pages/account/ProfilePanel.tsx` (cắt vuông 400 × 400, ưu tiên WebP trước khi upload) |
| `uploadAvatarRequest` | `POST /account/avatar` (multipart, field `file`) | `pages/account/ProfilePanel.tsx` (cắt vuông 400 × 400, ưu tiên WebP trước khi upload) |
| `changePasswordRequest` | `POST /account/change-password` | `pages/account/PasswordPanel.tsx` |
| `getSessions` | `GET /account/sessions` | `pages/account/SessionsPanel.tsx` |
| `revokeSessionRequest` | `POST /account/sessions/revoke` | `pages/account/SessionsPanel.tsx` |
| `getApps` | `GET /apps` | `pages/HomePage.tsx` |
| `getAdminApps` | `GET /admin/apps` | `pages/account/AppsAdminPanel.tsx` |
| `upsertAppRequest` | `POST /admin/apps` | `pages/account/AppsAdminPanel.tsx` (modal Thêm/Sửa) |
| `uploadAppIconRequest` | `POST /admin/apps/{app_id}/icon` | Upload ảnh PNG 138 × 138 để hiển thị ở 46 px sau khi lưu app; ảnh nguồn tối đa 1MB, mỗi lần upload có URL mới và đường dẫn ghi vào `a_app.icon` |
| `deleteAppRequest` | `POST /admin/apps/delete` | `pages/account/AppsAdminPanel.tsx` |
| `getAppAccessRequest` | `GET /admin/apps/{app_id}/access` | Danh sách người đang được cấp trực tiếp |
| `getAdminUsers` | `GET /admin/users` | Tải khi mở modal quyền để dựng một danh sách checkbox đầy đủ |
| `getAppAccessCandidatesRequest` | `GET /admin/apps/{app_id}/access-candidates` | Chỉ gọi khi mở modal “Thêm người”; tìm kiếm/lọc/phân trang ở backend |
| `addAppAccessRequest` | `POST /admin/apps/{app_id}/access/add` | Cộng quyền cho tập user được chọn, không ghi đè grant hiện tại |
| `removeAppAccessRequest` | `POST /admin/apps/{app_id}/access/remove` | Gỡ từng người hoặc một nhóm được chọn |
| `avatarSrc(raw)` | — (không gọi API) | helper suy URL trình duyệt tải được từ giá trị `avatar` lưu trong DB — xem bên dưới |

## Quy ước response — khác `build-web`

`ApiResult<T> = { ok: boolean; status: number; data: T & Partial<{ message: string }> }` — **không**
tự `throw` khi lỗi (khác `build-web/src/lib/api.ts` là axios interceptor tự chuẩn hoá lỗi thành
`Error`). Mỗi nơi gọi tự kiểm `res.ok`, đọc `res.data.message` khi cần hiện lỗi. Lý do khác biệt:
`sso-web` nhỏ, không có tầng `loader/`+`react-query` như `build-web`, gọi trực tiếp trong
`useEffect`/handler nên kiểm tra tường minh tại chỗ đơn giản hơn là dựng nguyên tầng error boundary.

## `avatarSrc()` — 2 dạng đường dẫn cũ/mới

Giá trị `avatar` lưu trong `user_profiles`: từ 25/09/2026 avatar mới do **api-core** lưu
theo format của api-core (`uploads\yyyy-mm-dd\...`, dùng `\` — Windows-style path; api-sso chỉ chuyển
tiếp file); record cũ có thể là `/api-sso/uploads/avatars/...` (api-sso từng tự lưu, vẫn serve). `avatarSrc()` (`api.ts`) quy cả 2
về URL gọi được từ trình duyệt: dạng mới → `${GATEWAY_URL}/api/api-sso/uploads/...`; dạng cũ →
`${GATEWAY_URL}/api/api-core/uploads/...` (route cũ vẫn còn, `api-core` không bị sửa — xem
`api-sso/docs/architecture.md`).
