# Architecture

## Vị trí trong hệ thống

```
Browser
  │
  ▼
sso-web (:5173 dev, nginx serve dist/ prod — port/domain riêng, độc lập build-web)
  │  gọi API same-origin (fetch, credentials: 'include', path tương đối /api/api-sso/*)
  ▼
nginx của chính sso-web (prod, config/default.conf) hoặc vite server.proxy (dev,
vite.config.ts) — proxy /api/* sang api-gateway
  ▼
api-gateway (:6688)
  │  rewrite /api/api-sso/* → /api-sso/*
  ▼
api-sso — auth, hồ sơ tài khoản, quản lý ứng dụng (xem api-sso/docs/architecture.md)
```

`sso-web` là **frontend độc lập** (như `build-web`/`task-web`), không phải trang tĩnh do
`api-gateway`/`api-sso` phục vụ — build riêng, publish port riêng (`docker-compose.real.yml` service
`sso-web`). Không tự mở cổng ra internet ngoài nginx phục vụ chính nó (đúng nguyên tắc
"chỉ frontend + gateway mở cổng").

Gọi API **same-origin** ở cả 2 môi trường, giống hệt `build-web`/`task-web` cả cơ chế lẫn tên biến
(`VITE_BASE_URL=/api`) — browser thấy cùng origin nên không cần CORS thật, tránh luôn vấn đề Safari
chặn `Set-Cookie` từ response cross-origin (xem `technical_decisions.md`).

Vai trò: (1) trang đăng nhập dùng chung cho mọi app trong hệ thống (build-web redirect sang đây khi
chưa đăng nhập — `build-web/src/urls.ts` `getLoginUrl()`), (2) trang chủ liệt kê app user được truy
cập, (3) trang "Quản lý tài khoản" (hồ sơ, mật khẩu, phiên đăng nhập, quản trị ứng dụng cho admin).

Trang chủ dùng skeleton theo đúng hình card khi tải lần đầu. Lỗi `/apps` giữ nguyên phiên và có retry
tại chỗ; refetch không xoá danh sách cũ. App chưa có URL hiển thị trạng thái “Chưa cấu hình URL” và
không điều hướng thay vì tạo link chết.

Motion dùng token CSS chung (press 140 ms, control 200 ms, reveal 280 ms, highlight 760 ms), chỉ reveal
nhẹ bằng `transform`/`opacity`. App card stagger ngắn và panel tài khoản crossfade khi đổi tab. Khi hệ
điều hành bật `prefers-reduced-motion`, animation không thiết yếu về 1 ms và Lottie đứng ở frame đầu.

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

Mỗi build phát sinh `/version.json` không cache (`app`, `version`, `buildId`,
`builtAt`). Request từ frontend gửi `X-Request-Id`, `X-Navigation-Id` và
`X-App-Version`; `api-sso` echo `X-Request-Id` để đối chiếu browser log với
server log mà không ghi token/cookie.

Các request auth/session dùng `fetch(..., { cache: 'no-store' })`; API cũng
trả `Cache-Control: no-store, private, must-revalidate`. Không cache/ETag
revalidation `/me`: quyền và phiên có thể đổi giữa hai request, và response
`304` trong lúc route auth remount từng gây vòng gọi `/me` + loading nháy.
`fetchMe()` là single-flight để StrictMode/route transition không tạo nhiều
request đồng thời. Khi `LoginPage` kiểm tra được phiên hợp lệ, trang ghi user
và trạng thái `authenticated` vào store trước khi điều hướng sang route bảo vệ.

Tab đang mở kiểm tra `/version.json` khi quay lại foreground/focus và mỗi 5
phút. Nếu server có build mới, app chỉ hiện banner để người dùng chủ động tải
lại sau khi đã lưu dữ liệu; không ép reload giữa thao tác.

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
| Thông tin cá nhân | `ProfilePanel` | Sửa họ tên/email/sđt/giới tính/ngày sinh, đổi avatar (cắt vuông 400 × 400, nén WebP khi trình duyệt hỗ trợ). Hiển thị thêm (chỉ đọc): tài khoản/chức vụ/phòng ban/chi nhánh |
| Mật khẩu | `PasswordPanel` | Đổi mật khẩu (mật khẩu cũ + mới + xác nhận) |
| Phiên đăng nhập | `SessionsPanel` | Liệt kê thiết bị đang đăng nhập (gộp theo trình duyệt+hệ điều hành đoán từ User-Agent bằng `describeAgent`, không dùng thư viện), thu hồi từng phiên (trừ phiên hiện tại). `describeAgent` tách client không phải trình duyệt trước (app Dart, Postman/Bruno, okhttp/curl...), rồi webview in-app (Zalo/Facebook/Instagram/LINE/TikTok/Viber), rồi trình duyệt (kiểm tra iOS trước macOS vì UA iOS chứa "like Mac OS X"). **Giới hạn UA không giải quyết được:** iPad bật "Desktop site" gửi UA giống hệt Mac nên hiện "macOS". Thêm client/trình duyệt mới thì đối chiếu `SELECT user_agent, count(*) FROM a_session GROUP BY 1` xem còn rơi vào "Trình duyệt khác" không |
| Quản lý ứng dụng | `AppsAdminPanel` | **Chỉ admin** — CRUD app; chọn ảnh icon tối đa 1MB, thu về PNG 138 × 138 để hiển thị sắc nét ở 46 px (app cũ chưa có ảnh vẫn hiện chữ trên nền màu); bảng hiển thị grant trực tiếp/tổng user; modal tải danh sách user khi mở, checkbox phản ánh quyền hiện tại và bộ lọc “Chỉ người chưa được phân quyền” chỉ ẩn các dòng đã chọn. Khi lưu, frontend tính delta thêm/gỡ. BE tự chặn 403 nếu gọi thẳng API, ẩn tab chỉ là UX |

Tab admin ẩn ở FE **không phải lớp bảo vệ duy nhất** — `api-sso` có `requireAdmin` riêng, xem
`api-sso/docs/architecture.md`.

## Docker

Multi-stage: build stage `npm i -g pnpm` + `pnpm build` (cần build arg `VITE_BASE_URL` — luôn `/api`,
giống `build-web`/`task-web` — `VITE_ALLOWED_REDIRECT_SUFFIX`, `VITE_COOKIE_DOMAIN` — Vite
bake env vào bundle lúc build, phải khai `ARG` + `ENV` promote trong Dockerfile, thiếu bước này build
arg bị bỏ qua âm thầm, bug thật đã gặp 3 lần khi làm `sso-web`/`build-web`). Production stage:
`nginx:alpine` serve `dist/` + proxy `/api/*` same-origin sang `api-gateway` (`config/default.conf`,
xem sơ đồ đầu file), SPA fallback (`try_files $uri $uri/ /index.html`) — cần thiết vì dùng `react-router`
(route như `/account` không có file thật trên disk).
