# Kế hoạch nâng cấp trải nghiệm SSO Web và Task Web

Ngày cập nhật: 18/09/2026  
Phạm vi: `sso-web`, `task-web`, `api-sso` và các cấu hình gateway/deploy liên quan.

Trạng thái triển khai:

- [x] P0 — build metadata, request correlation và bootstrap diagnostics.
- [x] P1 — chặn loading/redirect loop, timeout/retry và recovery state.
- [x] P2 — recovery frontend cũ/chunk lỗi và banner cập nhật chủ động.
- [x] P3 — API Quản lý ứng dụng.
- [x] P4 — UX Quản lý ứng dụng.
- [x] P5 — loading/error/empty state.
- [x] P6 — motion system.

## 1. Mục tiêu

1. Chấm dứt hiện tượng mở ứng dụng bị loading/redirect/reload lặp và xác định được nguyên nhân khi lỗi tái diễn.
2. Phân biệt đúng lỗi phiên đăng nhập, lỗi phân quyền, lỗi mạng/API và lỗi bundle frontend sau deploy.
3. Nâng chất lượng loading, empty, error và recovery state của hai ứng dụng.
4. Làm chuyển động có chủ đích, nhẹ và nhất quán, không ảnh hưởng hiệu năng hay accessibility.
5. Cải thiện màn **Quản lý ứng dụng**, gồm số liệu “Người truy cập” và luồng thêm người chưa có quyền.
6. Cho phép thay đổi API/database tương ứng khi đó là cách giải quyết đúng và ổn định hơn xử lý thuần frontend.

## 2. Kết quả audit hiện tại

### 2.1. Các đường có thể tạo loop

- `task-web/src/modules/app/AppLayout.tsx` hiện chỉ tách riêng lỗi `403`. Các lỗi bootstrap khác như timeout, mất mạng hoặc `5xx` đều có thể rơi vào `resetUser()` và chuyển sang SSO như thể phiên đã hết hạn.
- Khi cookie vẫn hợp lệ, `sso-web` kiểm tra `/me` thành công rồi chuyển ngược về `task-web`. Nếu API của Task vẫn lỗi, hai app có thể chuyển qua lại và làm màn loading nháy liên tục.
- `task-web/src/modules/error/ErrorTemp.tsx` tự reload khi dynamic import thất bại nhưng chưa giới hạn số lần. HTML cũ trỏ tới chunk đã bị xoá, CDN cache sai hoặc các replica chạy khác build có thể tạo reload loop.
- `sso-web/src/api.ts` dùng `fetch` chưa có timeout. `/me` hoặc API khác bị treo có thể giữ loading vô thời hạn.
- `task-web` có timeout Axios 60 giây, nhưng lỗi bootstrap sau timeout vẫn chưa có trạng thái “không thể kết nối” riêng.
- Nginx trong hai frontend đã đặt HTML `no-cache/no-store` và asset có hash `immutable`. Cấu hình này đúng ở origin, nhưng vẫn cần xác minh header thực tế qua CDN/reverse proxy và cách rollout nhiều replica.

### 2.2. Quản lý ứng dụng

- `GET /admin/apps` hiện trả `access_count`, là số dòng cấp quyền **trực tiếp** trong `a_app_access`.
- Chưa trả tổng số user active, nên frontend chỉ hiển thị được “N người”.
- `GET /admin/users` tải toàn bộ user active; modal hiện tại trộn việc xem người đã có quyền và thêm/bỏ quyền trong một bảng checkbox.
- `POST /admin/apps/{app_id}/access` thay toàn bộ tập quyền bằng một mảng `user_ids`. Cách này đơn giản nhưng tăng rủi ro ghi đè thay đổi của một admin khác và không phù hợp với modal “Thêm người” riêng.
- Admin có quyền hiệu lực với mọi app dù không có dòng `a_app_access`. Vì vậy cần phân biệt rõ “được cấp trực tiếp” và “có quyền hiệu lực”.

## 3. Nguyên tắc nghiệp vụ cho “Người truy cập”

### 3.1. Số liệu trên bảng ứng dụng

Hiển thị:

```text
Người truy cập
12 / 84 người
```

Quy ước:

- Tử số `direct_access_count`: số user active **không phải admin** đang được cấp trực tiếp trong `a_app_access` (migration 0014 loại admin — migration 0007 từng seed cả admin vào `a_app_access`, nếu đếm sẽ vượt mẫu số).
- Mẫu số `eligible_user_count`: tổng user active **không phải admin** đủ điều kiện cấp quyền, cùng điều kiện với danh sách `GET /admin/users` (cũng loại admin từ 0014). Tử/mẫu cùng loại admin nên tỉ lệ luôn ≤ 100%.
- Admin có quyền mặc định, không nằm trong tử số lẫn mẫu số; chỉ `effective_access_count` (admin + được cấp trực tiếp) mới tính admin.
- Tooltip/chú thích: “12 người được cấp trực tiếp. Quản trị viên hệ thống luôn có quyền truy cập.”

Không gọi tử số là “tổng người có quyền” vì như vậy sẽ sai khi có admin bypass. Nếu sản phẩm cần số người **thực sự có quyền hiệu lực**, API có thể trả thêm `effective_access_count`, nhưng không dùng nó để quản lý các dòng cấp trực tiếp.

### 3.2. Modal thêm người

- Modal “Thêm người” chỉ hiển thị user chưa có quyền hiệu lực với app.
- Admin bị loại khỏi danh sách ứng viên vì đã có quyền mặc định.
- User đã có dòng `a_app_access` bị loại.
- Chỉ lấy user đang active và profile đang active.
- Có tìm kiếm theo họ tên/tài khoản và lọc theo chức vụ.
- Có chọn từng người, chọn nhóm theo chức vụ, phân trang và trạng thái “không còn người để thêm”.
- Khi thêm thành công, cập nhật ngay danh sách hiện tại và chỉ số `x / y`, không đóng toàn bộ màn quản trị.

## 4. Kiến trúc trạng thái bootstrap/auth

Chuẩn hoá state machine cho cả hai frontend:

```text
checking_session
  ├─ 2xx  ───────────────▶ authenticated
  ├─ 401 + refresh fail ─▶ unauthenticated
  ├─ 403 app gate ───────▶ forbidden
  └─ timeout/network/5xx ▶ bootstrap_error
```

Quy tắc bắt buộc:

- Chỉ `401`, hoặc lỗi token gateway đã xác định rõ sau khi refresh thất bại, mới được chuyển người dùng sang SSO.
- `403` do app gate phải hiện trang không có quyền, không đăng nhập lại.
- Timeout, offline, DNS, `429` và `5xx` phải giữ người dùng tại app và hiện recovery state.
- Không dùng catch-all để quy mọi lỗi bootstrap thành `unauthenticated`.
- Retry tự động tối đa 1–2 lần với exponential backoff và jitter; không retry `401`, `403` hoặc lỗi validation.

## 5. Kế hoạch triển khai

### P0 — Observability và tái hiện lỗi

#### Frontend

- Bake `BUILD_ID`/commit SHA/build time vào `sso-web` và `task-web`.
- Cung cấp `/version.json` với `Cache-Control: no-store` và gắn version vào log lỗi.
- Tạo `navigation_id` trong `sessionStorage` cho một chuỗi bootstrap/redirect.
- Ghi nhận tối thiểu các event:
  - `app_boot_started`;
  - `session_check_succeeded`;
  - `session_check_failed` kèm nhóm lỗi;
  - `refresh_started/succeeded/failed`;
  - `redirect_to_sso`;
  - `chunk_load_failed`;
  - `version_reload_started/failed`.

#### API/gateway

- Thêm hoặc chuẩn hoá request/correlation ID xuyên gateway → `api-sso` → API nghiệp vụ.
- Log status, latency và nhóm lỗi cho `/me`, `/refresh`, `/apps` mà không log token/cookie.
- Trả `X-Request-Id` để frontend đưa vào trang lỗi hỗ trợ.

#### Kiểm tra vận hành

- Kiểm tra cache header thực tế qua domain production, không chỉ file nginx trong repo.
- Kiểm tra rollout nhiều replica có lúc phục vụ hai `index.html`/build khác nhau hay không.
- Xác minh asset của bản trước có bị xoá ngay khi còn tab cũ hay không.

**Hoàn thành khi:** một lần loop có thể phân loại thành stale build/chunk, lỗi API, hết phiên, thiếu quyền hoặc cấu hình redirect sai.

### P1 — Chặn loading và redirect loop

#### `task-web`

- Thêm trạng thái `bootstrap_error` vào auth store, chứa nhóm lỗi, message an toàn và `requestId`.
- Sửa bootstrap trong `AppLayout`: chỉ reset session với lỗi xác thực thực sự; timeout/network/`5xx` đi vào `bootstrap_error`.
- Tạo trang lỗi bootstrap với các hành động:
  - “Thử lại” — gọi lại `/me`;
  - “Về cổng ứng dụng” — về SSO home;
  - “Đăng nhập lại” — hành động chủ động, không tự chạy với lỗi API.
- Dùng progress/skeleton có nội dung “Đang kiểm tra phiên đăng nhập” thay spinner không ngữ cảnh.
- Sau 3–5 giây đổi microcopy thành “Kết nối đang chậm hơn bình thường”.

#### `sso-web`

- Thêm `AbortController` cho `request()`:
  - `/me` bootstrap: 10–15 giây;
  - request thông thường: khoảng 30 giây.
- Mở rộng session store với `error`; không coi lỗi mạng/`5xx` là unauthenticated.
- `RequireAuth` render recovery state thay vì chuyển `/login` khi backend không khả dụng.
- Trang login không giữ `checkingSession` vô hạn; nếu session check lỗi hạ tầng, hiện form kèm banner trạng thái và nút thử lại.

#### Chốt an toàn redirect

- Lưu lần redirect gần nhất trong `sessionStorage`.
- Nếu cùng cặp app/URL lặp lại trong khoảng 10–20 giây, dừng chuyển tự động và hiện thông báo ổn định.
- Đây là circuit breaker, không thay thế việc phân loại HTTP đúng.

### P2 — Recovery sau deploy/frontend cũ

- Thay reload vô điều kiện trong `ErrorTemp` bằng quy trình:
  1. Bắt đúng lỗi chunk/dynamic import.
  2. Lấy `/version.json` với `cache: no-store`.
  3. Nếu version server khác version đang chạy và chưa reload cho version đó, reload đúng một lần.
  4. Nếu đã reload hoặc version không đổi, hiện trang lỗi cập nhật với nút tải lại thủ công.
- Lưu version đã recovery trong `sessionStorage` để không reload vô hạn.
- Deploy atomic: upload đủ asset trước, rồi mới publish HTML mới.
- Giữ asset của ít nhất 1–2 release gần nhất nếu hạ tầng cho phép.
- Bảo đảm mọi replica trong một thời điểm phục vụ cùng release trước khi chuyển traffic.
- Khi phát hiện version mới trong phiên đang dùng, hiện banner “Đã có phiên bản mới”; không ép reload giữa lúc người dùng đang nhập form.

### P3 — API cho Quản lý ứng dụng

#### Migration database mới

Không sửa migration cũ `0005`/`0008`; tạo migration kế tiếp để `CREATE OR REPLACE` procedure hoặc thêm procedure mới.

1. Nâng `a_AdminListApps`:
   - `direct_access_count`: đếm `a_app_access` chỉ với user/profile active;
   - `eligible_user_count`: tổng user đủ điều kiện cấp quyền;
   - tùy chọn `effective_access_count`: số user có quyền sau khi tính admin bypass.
2. Thêm procedure danh sách ứng viên, ví dụ `a_AdminListAppAccessCandidates`:
   - input: `app_id`, `keyword`, `position_id`, `page`, `page_size`;
   - loại user đã có quyền trực tiếp;
   - loại admin vì đã có quyền hiệu lực;
   - trả `rows` và `total`;
   - sort ổn định theo `position_name`, `full_name`, `user_id`.
3. Thêm procedure cộng quyền theo delta, ví dụ `a_AdminAddAppAccess`:
   - nhận `user_ids jsonb`;
   - validate app active;
   - chỉ insert user hợp lệ, active, chưa có quyền;
   - dùng `ON CONFLICT DO NOTHING` hoặc ràng buộc tương đương để idempotent;
   - trả số người đã thêm.
4. Giữ `a_AdminSetAppAccess` trong giai đoạn tương thích, nhưng UI mới không dùng nó cho thao tác “Thêm người”.
5. Nếu màn danh sách người đang có quyền cần xoá từng người/bulk remove, thêm `a_AdminRemoveAppAccess`; không gửi lại toàn bộ danh sách chỉ để xoá một người.

#### Endpoint đề xuất

```text
GET    /admin/apps
GET    /admin/apps/{app_id}/access
GET    /admin/apps/{app_id}/access-candidates?q=&position_id=&page=&page_size=
POST   /admin/apps/{app_id}/access/add       { user_ids: string[] }
POST   /admin/apps/{app_id}/access/remove    { user_ids: string[] }
```

Response `GET /admin/apps`:

```json
{
  "app_id": "...",
  "app_key": "task",
  "app_name": "Quản lý nhiệm vụ",
  "direct_access_count": 12,
  "eligible_user_count": 84,
  "effective_access_count": 15
}
```

Response candidates nên có dạng phân trang:

```json
{
  "rows": [],
  "total": 72,
  "page": 1,
  "page_size": 20
}
```

Toàn bộ route tiếp tục dùng `requireAuth` + `requireAdmin`, khai báo bằng `defineRoute()` và Zod schema. Các thao tác vào bảng user dùng stored procedure theo quy ước `api-sso`.

### P4 — UX Quản lý ứng dụng

#### Bảng ứng dụng

- Đổi tiêu đề cột từ “Quyền truy cập” thành “Người truy cập”.
- Hiển thị `direct_access_count / eligible_user_count người` với số dạng tabular để không rung cột.
- Toàn bộ chỉ số là nút/link mở màn quản lý quyền.
- Tooltip giải thích admin có quyền mặc định.
- Khi tải lại sau mutation, giữ bảng hiện tại và cập nhật đúng dòng; không nháy toàn bảng.

#### Màn quản lý người truy cập

Tách hai nhiệm vụ:

1. **Danh sách đã được cấp quyền**
   - tìm kiếm, nhóm theo chức vụ;
   - xoá từng người hoặc chọn nhiều để xoá;
   - empty state rõ ràng;
   - admin mặc định không cần xuất hiện như một grant có thể xoá.
2. **Bộ lọc “Chỉ người chưa được phân quyền” trong modal quyền**
   - giữ một modal và một danh sách checkbox đầy đủ; người đã có quyền được checked;
   - danh sách user chỉ tải khi mở modal, không tải lúc mount panel;
   - bộ lọc ẩn người đã được checked, không mở modal hay danh sách thứ hai;
   - tìm kiếm có debounce 250–350ms;
   - lọc chức vụ;
   - checkbox từng người/chọn nhóm trong tập kết quả hiện tại;
   - footer hiển thị “Đã chọn N người”;
   - sau thêm thành công, xoá các user đó khỏi candidate cache và cập nhật count/list hiện tại;
   - khi không còn ứng viên: “Tất cả người dùng phù hợp đã có quyền truy cập.”

Không tải toàn bộ user ngay khi mount `AppsAdminPanel`. Với dữ liệu lớn, lọc và phân trang phải thực hiện ở backend.

### P5 — UX loading/error/empty cho hai app

#### `sso-web`

- Session check có nhãn trạng thái, slow state và retry.
- Danh sách app dùng skeleton đúng hình card; lỗi `/apps` có retry tại chỗ.
- Phân biệt app có quyền, app chưa cấu hình URL và app tạm không khả dụng.
- Các panel tài khoản loading độc lập, không chặn toàn trang.

#### `task-web`

- Sau auth, render app shell ổn định; nội dung route dùng skeleton cục bộ.
- Refetch giữ dữ liệu cũ và dùng progress nhỏ, không thay cả bảng bằng spinner.
- Mutation một task chỉ loading đúng hàng/nút liên quan.
- Drawer task mở ngay với skeleton cấu trúc; từng vùng lỗi có retry riêng.
- Thêm offline banner cấp ứng dụng và dedupe notification lỗi mạng.
- Chuẩn hoá bốn nhóm state: không có dữ liệu, không có quyền, mất kết nối, lỗi hệ thống.

### P6 — Motion system

Không thêm animation library mới ở giai đoạn đầu. `task-web` đã có Framer Motion; hai app đã có Lottie.

Motion tokens:

| Loại | Thời lượng |
| --- | ---: |
| Press/micro feedback | 120–160 ms |
| Button/menu/popover | 180–220 ms |
| Drawer/modal/page reveal | 240–320 ms |
| Row success highlight | 600–900 ms |

Quy tắc:

- Chỉ animate `transform` và `opacity` khi có thể.
- Hỗ trợ `prefers-reduced-motion` cho CSS, Framer Motion và Lottie.
- Loading animation phải dừng/unmount khi sang error state.
- Không dùng animation để trì hoãn auth/navigation.
- `sso-web`: crossfade form đăng nhập/quên mật khẩu, stagger nhẹ app card, success transition ngắn.
- `task-web`: drawer slide/fade, skeleton→data crossfade, bulk toolbar xuất hiện từ cạnh dưới, highlight đúng task vừa cập nhật.
- Biểu đồ chỉ animate lần tải đầu; refetch không chạy lại toàn bộ animation.

## 6. Thứ tự và ước lượng

| Giai đoạn | Kết quả | Ước lượng |
| --- | --- | ---: |
| P0 | Có version/correlation/log để phân loại loop | 1–2 ngày |
| P1 | Không còn redirect loop do lỗi API | 2–3 ngày |
| P2 | Recovery stale chunk có giới hạn, deploy an toàn | 1–2 ngày FE + DevOps |
| P3 | API/count/candidates/add-remove access | 2–3 ngày |
| P4 | UX Quản lý ứng dụng mới | 2–3 ngày |
| P5 | Loading/error/empty states trọng điểm | 3–5 ngày |
| P6 | Motion system và polish | 2–3 ngày |
| QA | Browser thật, mạng chậm, stale tab, concurrency | 1–2 ngày |

Thứ tự khuyến nghị: `P0 → P1 → P2 → P3 → P4 → P5 → P6`.

## 7. Tiêu chí nghiệm thu

### Auth/loading/deploy

- `/me` trả timeout/network/`5xx` không chuyển sang SSO.
- `401` chỉ redirect sau khi refresh thất bại.
- `403` app gate luôn hiện trang không có quyền.
- Dynamic import lỗi chỉ tự reload tối đa một lần cho mỗi version.
- Không có full-page loading vô hạn; quá timeout phải có error state và retry.
- Tab mở từ release cũ phục hồi được sau deploy mới.
- Không nháy nội dung protected hoặc sai theme trước khi bootstrap hoàn tất.

### Quản lý ứng dụng

- Cột “Người truy cập” hiển thị đúng `được cấp trực tiếp / tổng user đủ điều kiện`.
- Tổng user sử dụng cùng điều kiện active với danh sách ứng viên.
- Tooltip nói rõ quyền mặc định của admin.
- Modal “Thêm người” không hiển thị người đã có quyền hoặc admin bypass.
- Search/filter/pagination giữ đúng selection và không thêm trùng.
- Hai admin thao tác gần đồng thời không làm mất grant không liên quan do gửi lại toàn bộ tập cũ.
- Thêm/xoá thành công cập nhật list và count tại chỗ; lỗi API giữ modal và selection để thử lại.

### Accessibility/performance

- Keyboard dùng được toàn bộ bảng, modal, checkbox và action.
- Focus trở lại đúng nút mở modal sau khi đóng.
- Có focus ring rõ ràng và aria-label cho icon-only action.
- `prefers-reduced-motion` tắt chuyển động không thiết yếu.
- Không tải toàn bộ user khi chỉ mở tab Quản lý ứng dụng; candidates chỉ tải khi mở modal.

## 8. Kiểm thử bắt buộc

### Tình huống auth/deploy

1. `/me` trả `200`, `401`, `403`, `429`, `500`.
2. `/me` treo quá timeout và browser offline giữa request.
3. Access token hết hạn, refresh thành công/thất bại.
4. Nhiều request đồng thời nhận `401`.
5. Tab cũ gọi chunk đã bị thay sau deploy.
6. Hai replica cố tình chạy hai build để xác nhận cơ chế phát hiện.
7. Redirect qua lại SSO ↔ Task và circuit breaker.

### Tình huống quản lý quyền

1. App chưa cấp ai: `0 / N`.
2. Thêm một người, nhiều người và cả nhóm chức vụ.
3. Search rồi chọn, đổi trang, quay lại vẫn giữ selection đúng.
4. User vừa bị khoá/deactivate trước khi bấm Thêm.
5. User vừa được admin khác cấp quyền trước khi submit — API vẫn idempotent.
6. Hai admin thêm/xoá đồng thời không ghi đè toàn bộ danh sách.
7. Admin bypass không xuất hiện trong candidates.
8. Dark mode, font lớn, viewport mobile và `prefers-reduced-motion`.

Kiểm tra tĩnh cuối mỗi phần:

- `sso-web`: `pnpm typecheck` và test browser thật với `api-gateway` + `api-sso`.
- `task-web`: `pnpm lint` và test browser thật với các API liên quan.
- `api-sso`: `pnpm typecheck`, cập nhật Swagger/docs và kiểm tra migration trên môi trường an toàn trước production.

## 9. Tài liệu phải cập nhật khi triển khai

- `sso-web/docs/architecture.md`, `api.md`, `technical_decisions.md`.
- `task-web/docs/architecture.md`, `technical_decisions.md`; thêm mục mới ở đầu `features_issues.md` nếu ghi nhận/fix bug thật.
- `api-sso/docs/api.md`, `database.md`, `architecture.md`, `technical_decisions.md`.
- Tài liệu deploy/runbook cho version endpoint, cache policy, rollout và rollback.
