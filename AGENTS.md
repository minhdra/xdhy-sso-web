# AGENTS.md

Quy tắc cho AI agent (bất kỳ công cụ nào) làm việc trong `sso-web`. Đọc trước khi sửa code — app này nhỏ
và đơn giản hơn `build-web`/`task-web` (không react-query, không bảng dữ liệu lớn), đừng mang nguyên
pattern của 2 app kia sang đây mà không kiểm tra trước.

## Trước khi đoán — đọc, đừng suy đoán

- **Không dùng `@tanstack/react-query`/`axios`/layer `loader`** như `build-web`/`task-web` — mọi API gọi
  qua 1 hàm `request()` dùng chung trong `src/api.ts` (`fetch` thuần, `credentials: 'include'`), mỗi
  panel tự `useState`/`useEffect` + hàm `load()` gọi lại tay sau khi mutate. Đây là quyết định có chủ ý
  (app nhỏ, không đáng thêm cache/invalidate tự động) — xem
  [`docs/technical_decisions.md`](./docs/technical_decisions.md) mục "`fetch` thuần, không axios/
  react-query", không phải thiếu sót cần "sửa cho giống" `build-web`.
- **Không có `TableRender`/`ModalRender` (`constant/antd.tsx`) như `build-web`/`task-web`** — app này
  không có bảng dữ liệu dạng danh sách/phân trang lớn (trừ `AppsAdminPanel`, vẫn tự dựng bằng antd
  `Table` trần vì danh sách app nhỏ, không cần tính năng của wrapper đó). Đừng tự import wrapper từ repo
  khác.
- **`docs/features_issues.md` (changelog) chưa tồn tại trong repo này.** Nếu tạo mới vì có thay đổi đáng
  ghi, theo đúng format "mục mới ở đầu file, mỗi mục gắn ngày" như `build-web`/`task-web`/`api-sso` đã
  làm, không phải TODO list.
- **Tab "Quản lý ứng dụng" ẩn ở FE khi không phải admin KHÔNG PHẢI lớp bảo vệ thật** — `api-sso` tự chặn
  `403` qua `requireAdmin` nếu gọi thẳng API. Đừng coi việc ẩn tab là đủ, và đừng thêm check quyền phức
  tạp hơn ở FE cho việc này (không cần thiết, BE đã lo).
- **`?redirect=` sau đăng nhập phải qua allowlist (`VITE_ALLOWED_REDIRECT_SUFFIX`)** — đây là chặn
  open-redirect có chủ đích (`LoginPage.tsx`), không phải bug/giới hạn tạm. Đừng "sửa" cho theo thẳng mọi
  giá trị `redirect` để "linh hoạt hơn" — xem
  [`docs/technical_decisions.md`](./docs/technical_decisions.md) mục "Chặn open-redirect".

## Bug đã xảy ra thật — tránh lặp lại

- **Biến `VITE_*` (`VITE_BASE_URL`, `VITE_ALLOWED_REDIRECT_SUFFIX`, `VITE_COOKIE_DOMAIN`) bị Vite bake
  cứng vào bundle lúc `build`, không đọc lại lúc chạy.** Đổi giá trị trong `.env`/Dockerfile build-arg mà
  không rebuild image thì FE vẫn dùng giá trị cũ — đã xảy ra thật **3 lần** giữa `sso-web`/`build-web`
  (thiếu bước khai `ARG` + `ENV` promote trong Dockerfile). Đừng debug nhầm hướng "biến env không load"
  khi vấn đề thật là chưa rebuild.
- **Đổi tên cookie theme (`xdhy_theme_mode`) phải khớp đúng `build-web`** (`src/constant/config.ts`
  `LOCAL_THEME_MODE`) nếu muốn đồng bộ sáng/tối 2 chiều giữa 2 app tiếp tục hoạt động — đổi 1 bên mà
  quên bên kia thì đồng bộ âm thầm gãy, không có lỗi nào hiện ra để nhận biết ngay. Xem
  [`docs/technical_decisions.md`](./docs/technical_decisions.md) mục "Đồng bộ theme sáng/tối".

## Quy ước bắt buộc theo khi thêm code mới

- Form mới dùng `RULES_FORM` (`src/validator.ts`) — bản rút gọn chép tay từ `build-web`
  (`required`/`email`/`phone`/`passwordMin`), **không** import trực tiếp từ `build-web` (2 repo độc lập,
  không có workspace chung). Thêm rule mới thì viết tại đây, không phải sang `build-web` sửa rồi cố gắng
  chia sẻ.
- Gọi API mới: thêm hàm vào `src/api.ts` theo đúng khuôn `get`/`post`/`put` + `request()` đã có, không tự
  gọi `fetch` rời rạc trong component.
- State dùng chung nhiều component: `zustand` (`src/store/*.ts`), không dùng React Context/Redux — theo
  đúng quyết định đã chốt, xem [`docs/technical_decisions.md`](./docs/technical_decisions.md).
- API gọi luôn qua path tương đối `VITE_BASE_URL=/api` (same-origin, proxy bởi nginx của chính `sso-web`
  hoặc vite `server.proxy` lúc dev) — **không** gọi cross-origin thẳng tới `api-gateway` bằng URL tuyệt
  đối. Cross-origin từng bị Safari chặn `Set-Cookie` dù có `credentials: 'include'` + CORS đúng, đã đổi
  hướng có chủ đích — xem [`docs/technical_decisions.md`](./docs/technical_decisions.md).
- Trang/panel mới cần dữ liệu ảnh (avatar...): dùng `avatarSrc()` (`src/api.ts`) để resolve URL, không tự
  ghép path tay — hàm này đã xử lý cả path thô lẫn URL backend trả sẵn.

## Yêu cầu test — dự án chưa có test tự động, cũng chưa có eslint

Không có `*.test.*`/`*.spec.*`, không cài vitest/jest/cypress/playwright, **và không có script `lint`
trong `package.json`** (chỉ có `dev`/`build`/`typecheck`/`preview`) — khác `build-web`/`task-web`. Chạy
`pnpm typecheck` là đủ ở tầng kiểm tra tĩnh, nhưng **không đảm bảo** UI/luồng auth chạy đúng — bắt buộc
test tay trong browser thật trước khi báo xong việc:

```bash
pnpm dev   # http://localhost:5173, proxy /api sang :6688 (api-gateway)
```

Cần `api-gateway` + `api-sso` + `api-core` đang chạy để test được auth thật (không mock được — cookie
httpOnly do backend set). Xem thứ tự khởi động đầy đủ ở
[`../api-sso/docs/local_dev.md`](../api-sso/docs/local_dev.md). Với luồng đăng nhập/redirect: test tối
thiểu login → có `?redirect=` hợp lệ (path nội bộ) đi đúng hướng, `?redirect=` domain lạ bị chặn (không
điều hướng ra ngoài allowlist).

## Sau khi sửa xong

- `pnpm typecheck` — 0 lỗi trước khi coi là xong.
- Đã test tay trong browser thật (mục trên) — không chỉ dựa vào typecheck pass để báo "xong".
- **Đổi/thêm business rule, luồng auth, API mới, hoặc quyết định kỹ thuật → BẮT BUỘC cập nhật `docs/*.md`
  tương ứng trong CÙNG LƯỢT, không đợi user nhắc.** Grep tên rule/component/route liên quan trong `docs/`
  trước khi báo hoàn thành; không có doc nào nhắc tới thì thôi, có mà không cập nhật là sai.
- Không tự ý `git push`/tạo PR/merge trừ khi được yêu cầu rõ.
