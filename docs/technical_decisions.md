# Technical Decisions

Quyết định kỹ thuật + lý do — không lặp lại "làm gì" (đã có ở [`architecture.md`](./architecture.md)).

## Frontend độc lập, không do `api-gateway`/`api-sso` phục vụ

**Chọn:** `sso-web` build/deploy như 1 app riêng (Vite+React+antd, port/domain riêng), publish HTML
tĩnh + nginx của chính nó. **Thử trước đó:** phục vụ trang login qua `api-gateway` (HTML+JS thuần,
same-origin với `api-sso`) — đơn giản hơn lúc đầu. **Đổi hướng vì:** yêu cầu giao diện tăng dần (toast
thật, dark mode, form quên mật khẩu, rồi cả trang "Quản lý tài khoản" nhiều tab) khiến HTML tĩnh không
còn hợp lý — cần React/antd đầy đủ. Xem thêm góc nhìn từ phía `api-sso` ở
[`api-sso/docs/technical_decisions.md`](../../api-sso/docs/technical_decisions.md).

## Gọi API same-origin qua nginx proxy của chính nó, không cross-origin thật

**Chọn:** nginx của `sso-web` (`config/default.conf`) proxy `/api/*` sang `api-gateway` cùng origin với
trang, dev dùng vite `server.proxy` (`vite.config.ts`) làm y hệt việc đó — `api.ts` gọi path tương đối
qua `VITE_BASE_URL=/api` (`BASE = \`${BASE_URL}/sso\``), không dùng URL tuyệt đối, ở **cả 2 môi
trường**. **Thử trước đó:** gọi cross-origin thẳng qua `VITE_GATEWAY_URL` (URL tuyệt đối tới gateway,
biến riêng chỉ `sso-web` có) + CORS riêng (`SSO_ORIGIN` bên `api-gateway`), dev không có vite proxy nên
bắt buộc cross-origin. **Đổi hướng vì (07/09/2026):** 3 lý do — (1) nhất quán với
`build-web`/`task-web` cả tên biến (`VITE_BASE_URL=/api`) lẫn cơ chế (nginx proxy production + vite
`server.proxy` dev) — không app nào khác gọi cross-origin thật cả, cross-origin ở `sso-web` là ngoại lệ
không cần thiết, (2) Safari chặn `Set-Cookie` từ response cross-origin trong nhiều trường hợp (kể cả có
`credentials: 'include'` + CORS đúng) — same-origin loại bỏ hẳn lớp rủi ro này ở cả dev lẫn production,
(3) xoá được hẳn 1 biến env riêng biệt (`VITE_GATEWAY_URL`) không có ở 2 app kia. **Đánh đổi:** mất khả
năng tách domain hoàn toàn độc lập không qua proxy nào — chấp nhận được vì `sso-web` vẫn giữ nguyên
port/container riêng, chỉ nginx/vite của nó biết `api-gateway` ở đâu. Biến `SSO_ORIGIN` bên `api-gateway`
đã **xoá hẳn** (07/09/2026, không giữ fallback) — CORS cho sso-web không còn ý nghĩa gì nữa nên giữ lại
chỉ gây hiểu lầm là còn cần cấu hình.

## Zustand thay vì Context/Redux cho state

**Chọn:** 2 store nhỏ (`session`, `theme`) bằng `zustand`, không dùng React Context hay Redux. **Vì
sao:** khớp pattern `build-web` đã dùng (`src/lib/atom.ts` — dù `build-web` có thêm 1 lớp tương thích
API cũ từ thời Recoil mà `sso-web` không cần, vì viết mới hoàn toàn không có nợ kỹ thuật đó). Context
API thuần đủ cho app nhỏ này nhưng zustand tránh re-render toàn cây khi 1 phần state đổi (vd đổi theme
không re-render lại toàn bộ form đang mở).

## `fetch` thuần, không axios/react-query

**Chọn:** 1 hàm `request()` dùng chung trong `api.ts`, không cache, không retry tự động. **Vì sao:**
`sso-web` không có danh sách dữ liệu lớn cần phân trang/cache như `build-web` (task list, bảng nhân
sự...) — mỗi trang gọi API 1-2 lần lúc mount, không đáng để mang thêm `@tanstack/react-query` + tầng
`loader/`. Đánh đổi: không có cơ chế refetch/invalidate tự động — mỗi panel tự `useState` + `useEffect`
+ hàm `load()` gọi lại tay sau khi mutate (xem `SessionsPanel.tsx`, `AppsAdminPanel.tsx`).

Riêng `AppsAdminPanel`, danh sách user không tải lúc panel mount mà chỉ tải khi mở modal quyền. Modal
luôn dùng một danh sách checkbox đầy đủ; grant hiện tại được checked, còn “Chỉ người chưa được phân
quyền” là bộ lọc client-side. Khi lưu, frontend so sánh tập ban đầu/tập mới rồi gọi API cộng/gỡ theo
delta, sau đó refetch count ứng dụng.

## Đồng bộ theme sáng/tối với `build-web`: cookie + localStorage

**Chọn:** `theme.ts` đọc/ghi theo thứ tự ưu tiên — cookie domain cha (`xdhy_theme_mode`, ghi mới) →
cookie cũ (`theme_mode`, chỉ **đọc** để tương thích ngược, không còn ghi) → `localStorage`
(`sso_theme_mode`, riêng origin `sso-web`) → mặc định `light`. **Vì sao:** cookie domain cha là kênh
DUY NHẤT chia sẻ được giữa các origin khác nhau (`build-web` ↔ `sso-web`), nhưng chỉ hoạt động khi
`VITE_COOKIE_DOMAIN` được cấu hình (rỗng lúc dev local trên `localhost`) — `localStorage` là lưới an
toàn để `sso-web` vẫn tự nhớ lựa chọn của chính nó dù không đồng bộ được sang app khác lúc đó. **Cần
biết khi đổi:** đổi tên cookie ở đây phải khớp đúng với `build-web` (`src/constant/config.ts`
`LOCAL_THEME_MODE`) nếu muốn đồng bộ 2 chiều tiếp tục hoạt động — nhánh đọc cookie cũ tồn tại chính vì
lần đổi tên gần nhất, tránh vỡ đột ngột với cookie đã set từ trước.

## Chặn open-redirect qua `VITE_ALLOWED_REDIRECT_SUFFIX`

**Chọn:** `LoginPage.tsx` chỉ theo `?redirect=` nếu là path nội bộ (bắt đầu `/`) hoặc origin `https:`
có hostname kết thúc bằng `VITE_ALLOWED_REDIRECT_SUFFIX` (build-time, vd `.xaydung.vn`). **Vì sao:**
`sso-web` là trang login dùng chung — không kiểm tra thì ai cũng chèn được `?redirect=https://evil.com`
sau khi đăng nhập thật, dẫn thẳng nạn nhân sang trang giả mạo cùng phiên vừa xác thực.

## Avatar: upload file thật, không nhận URL dán tay

**Chọn:** `ProfilePanel` dùng antd `Upload` gửi `multipart/form-data` tới `POST /account/avatar`, không
có ô nhập URL. **Bối cảnh:** phương án đầu (nhanh hơn để làm) là cho dán URL ảnh có sẵn — user yêu cầu
rõ phải là upload thật. **Đánh đổi:** cần thêm `multer` + static serve ở `api-sso` (xem
`api-sso/docs/architecture.md` mục Upload avatar) thay vì chỉ validate 1 chuỗi URL.
Từ 25/09/2026 file vật lý chuyển về **api-core** (api-sso chỉ nhận multipart rồi chuyển tiếp) để mọi
app đọc cùng 1 dạng path của api-core (`uploads/yyyy-mm-dd/...`) — sso-web không đổi gì, endpoint + response giữ nguyên.

## Trang quản trị ứng dụng nằm trong tab của `AccountPage`, không phải route `/admin` riêng

**Chọn:** "Quản lý ứng dụng" là tab thứ 4 trong `AccountPage` (ẩn nếu không phải admin), tái dùng đúng
layout sidebar + panel đã có, không dựng route/shell riêng. **Vì sao:** nhất quán về mặt thiết kế (đúng
yêu cầu lúc giao việc) và tận dụng lại toàn bộ hạ tầng đã có (`AppHeader`, style `.ssoAccount-*`,
`RequireAuth`) — không phải maintain 2 shell khác nhau cho 1 app quy mô nhỏ.

## `RULES_FORM` copy rút gọn từ `build-web`, không import package dùng chung

**Chọn:** `validator.ts` chép lại 4 rule cần dùng (`required`/`email`/`phone`/`passwordMin`) thay vì
import từ `build-web`. **Vì sao:** 2 repo là 2 unit deploy độc lập, không có package dùng chung/monorepo
tooling (`pnpm workspace` không được thiết lập giữa các service) — copy trực tiếp đơn giản hơn dựng hạ
tầng chia sẻ code cho vài dòng rule. Đánh đổi: sửa message lỗi ở 1 nơi phải nhớ sửa ở nơi kia nếu muốn
giữ nhất quán UX.

## Lazy-load route và panel tài khoản (20/09/2026)

**Chọn:** `LoginPage`, `ResetPasswordPage`, `HomePage` và `AccountPage` được tải theo route; bốn panel
trong Account chỉ tải khi người dùng mở tab tương ứng. **Vì sao:** trước đây một bundle khởi đầu chứa cả
login, animation, danh sách phiên và bảng quản trị ứng dụng, làm trang đầu tải/phân tích JavaScript chậm
không cần thiết. Theme shell và kiểm tra phiên vẫn ở bundle đầu để không thay đổi luồng đăng nhập; màn
cần thiết hiện fallback tối giản trong lúc chunk tải.
