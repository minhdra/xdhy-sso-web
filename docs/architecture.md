# Architecture

## Vị trí trong hệ thống

```
Browser
  │
  ▼
sso-web (:5173 dev, nginx serve dist/ prod — port/domain riêng, độc lập build-web)
  │  gọi API cross-origin (fetch, credentials: 'include') sang api-gateway
  ▼
api-gateway (:6688)
  │  rewrite /api/sso/* → /api-sso/*, CORS riêng cho origin sso-web (SSO_ORIGIN)
  ▼
api-sso — auth, hồ sơ tài khoản, quản lý ứng dụng (xem api-sso/docs/architecture.md)
```

`sso-web` là **frontend độc lập** (như `build-web`), không phải trang tĩnh do `api-gateway`/`api-sso`
phục vụ — build riêng, publish port riêng (`docker-compose.sso-sandbox.yml` service
`sso-web-sandbox`). Không tự mở cổng ra internet ngoài nginx phục vụ chính nó (đúng nguyên tắc "chỉ
frontend + gateway mở cổng").

Vai trò: (1) trang đăng nhập dùng chung cho mọi app trong hệ thống (build-web redirect sang đây khi
chưa đăng nhập — `build-web/src/urls.ts` `getLoginUrl()`), (2) trang chủ liệt kê app user được truy
cập, (3) trang "Quản lý tài khoản" (hồ sơ, mật khẩu, phiên đăng nhập, quản trị ứng dụng cho admin).

## Cấu trúc `src/`

```
pages/            — LoginPage, ResetPasswordPage (công khai) + HomePage, AccountPage (cần đăng nhập)
pages/account/    — 4 panel trong AccountPage: ProfilePanel, PasswordPanel, SessionsPanel, AppsAdminPanel
components/       — AppHeader (menu user + toggle theme), RequireAuth (route guard)
store/            — zustand: session.ts (phiên đăng nhập), theme.ts (sáng/tối)
api.ts            — mọi lời gọi API, 1 hàm request() dùng chung
theme.ts, ThemeProvider.tsx — token antd + đồng bộ theme qua cookie/localStorage
validator.ts      — RULES_FORM dùng chung cho các Form (rút gọn từ build-web/src/utils/validator.ts)
```

## Routing (`App.tsx`, react-router)

```
/login            — công khai (LoginPage)
/reset-password   — công khai (ResetPasswordPage, đọc ?token= từ email)
/  (RequireAuth)  — HomePage
/account          — AccountPage (?tab=profile|password|sessions|apps-admin)
* (catch-all)     — redirect về /
```

`RequireAuth` (`components/RequireAuth.tsx`) bọc route cần đăng nhập: gọi `GET /me` (qua
`useSessionStore.fetchMe`) 1 lần lúc mount, hiện `Spin` khi đang chờ, redirect `/login?redirect=...`
nếu 401. Không dùng `react-router` loader — pattern giống `build-web` (`AppLayout.tsx`, 3 trạng thái
`loading/authenticated/unauthenticated`, bắt buộc phân biệt `loading` với `unauthenticated` để F5 không
bị đá về login oan trước khi `/me` kịp trả lời).

Tab trong `/account` đọc/ghi qua `useSearchParams` (không phải route con `react-router`) — đơn giản hơn
cho 1 trang có vài panel chuyển qua lại, không cần nested route.

## State (zustand)

- `store/session.ts` — `status` (3 trạng thái) + `user` (kết quả `/me`, gồm `is_admin`). `setUser()` để
  các panel cập nhật cục bộ sau khi sửa hồ sơ/avatar (không phải fetch lại `/me`).
- `store/theme.ts` — `mode` (`light`/`dark`) + `toggle()`. Ghi `data-theme` lên `<html>` **ngay khi đổi**
  (không đợi re-render) để CSS token phản ứng tức thời; ghi cookie/localStorage để nhớ qua lần tải
  trang sau — chi tiết cơ chế đồng bộ xem [`technical_decisions.md`](./technical_decisions.md).

`ThemeProvider.tsx` bọc `ConfigProvider` (antd) đọc từ `useThemeStore` — phải nằm **trong** cây React
(không set 1 lần ở `main.tsx` như bản đầu) để đổi theme là live, không cần reload trang.

## Auth flow (phía FE)

1. Chưa có cookie → `RequireAuth` nhận 401 từ `/me` → redirect `/login?redirect=<path hiện tại>`.
2. `LoginPage` submit `POST /login` (qua `api.ts` `loginRequest`) — thành công thì:
   - Có `redirect` hợp lệ (path nội bộ, hoặc domain con nằm trong `VITE_ALLOWED_REDIRECT_SUFFIX` —
     chặn open-redirect) → `window.location.href = redirect` (điều hướng cứng, có thể sang app khác).
   - Không có → `navigate('/')` (vào trang chủ sso-web).
3. Access token hết hạn giữa chừng: **chưa có interceptor tự refresh** ở `sso-web` (khác `build-web` —
   `sso-web` là phiên ngắn, user thường chỉ ở đây lúc đăng nhập/sửa hồ sơ, không phải làm việc liên
   tục) — 401 từ 1 API cụ thể hiện lỗi tại chỗ (`notification.error`), không tự động gọi `/refresh`.
4. Đăng xuất: `AppHeader` gọi `POST /logout` rồi `window.location.href = '/login'` (full reload, đảm
   bảo mọi state trong bộ nhớ bị xoá sạch).

## Trang "Quản lý tài khoản" (`AccountPage.tsx`)

4 tab, tab cuối chỉ hiện nếu `useSessionStore().user.is_admin`:

| Tab | Panel | Việc gì |
| --- | --- | --- |
| Thông tin cá nhân | `ProfilePanel` | Sửa họ tên/email/sđt/giới tính/ngày sinh, đổi avatar (upload thật, không phải URL). Hiển thị thêm (chỉ đọc): tài khoản/chức vụ/phòng ban/chi nhánh |
| Mật khẩu | `PasswordPanel` | Đổi mật khẩu (mật khẩu cũ + mới + xác nhận) |
| Phiên đăng nhập | `SessionsPanel` | Liệt kê thiết bị đang đăng nhập (gộp theo trình duyệt+hệ điều hành đoán từ User-Agent), thu hồi từng phiên (trừ phiên hiện tại) |
| Quản lý ứng dụng | `AppsAdminPanel` | **Chỉ admin** — CRUD app hiển thị ở trang chủ + chọn người được truy cập từng app. BE tự chặn 403 nếu gọi thẳng API, ẩn tab chỉ là UX |

Tab admin ẩn ở FE **không phải lớp bảo vệ duy nhất** — `api-sso` có `requireAdmin` riêng, xem
`api-sso/docs/architecture.md`.

## Docker

Multi-stage: build stage `npm i -g pnpm` + `pnpm build` (cần build arg `VITE_GATEWAY_URL`,
`VITE_ALLOWED_REDIRECT_SUFFIX`, `VITE_COOKIE_DOMAIN` — Vite bake env vào bundle lúc build, phải khai
`ARG` + `ENV` promote trong Dockerfile, thiếu bước này build arg bị bỏ qua âm thầm, bug thật đã gặp 3
lần khi làm `sso-web`/`build-web`). Production stage: `nginx:alpine` serve `dist/`, SPA fallback
(`try_files $uri $uri/ /index.html`) — cần thiết vì dùng `react-router` (route như `/account` không có
file thật trên disk).
