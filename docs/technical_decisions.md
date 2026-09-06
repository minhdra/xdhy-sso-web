# Technical Decisions

Quyết định kỹ thuật + lý do — không lặp lại "làm gì" (đã có ở [`architecture.md`](./architecture.md)).

## Frontend độc lập, không do `api-gateway`/`api-sso` phục vụ

**Chọn:** `sso-web` build/deploy như 1 app riêng (Vite+React+antd), gọi API cross-origin. **Thử trước
đó:** phục vụ trang login qua `api-gateway` (HTML+JS thuần, same-origin với `api-sso`) — đơn giản hơn
lúc đầu (không cần CORS). **Đổi hướng vì:** yêu cầu giao diện tăng dần (toast thật, dark mode, form
quên mật khẩu, rồi cả trang "Quản lý tài khoản" nhiều tab) khiến HTML tĩnh không còn hợp lý — cần
React/antd đầy đủ. Xem thêm góc nhìn từ phía `api-sso` ở
[`api-sso/docs/technical_decisions.md`](../../api-sso/docs/technical_decisions.md).

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
