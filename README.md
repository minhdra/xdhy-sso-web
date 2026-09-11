# sso-web

Frontend cổng đăng nhập tập trung (SSO) cho hệ thống XDHY — trang đăng nhập/quên mật khẩu dùng chung,
trang chủ liệt kê ứng dụng người dùng được cấp quyền, và trang "Quản lý tài khoản" (hồ sơ/mật khẩu/
phiên đăng nhập). Build bằng **React + Vite + Ant Design**, là 1 app **độc lập** (origin/port riêng),
không phục vụ qua `api-gateway` như phần API.

## Stack

- React 18 + TypeScript
- Vite (build/dev server), SWC
- Ant Design 5 (`antd`, `@ant-design/icons`)
- Zustand (state)
- react-router-dom
- lottie-web (animation loading/minh hoạ)

## Yêu cầu

- Node.js >= 18
- pnpm

## Cài đặt

```bash
pnpm install
cp .env.example .env   # rồi điền giá trị thật, xem giải thích từng biến trong chính file .env.example
```

`sso-web` gọi API **same-origin**, giống hệt `build-web`/`task-web`: production nginx của chính nó
(`config/default.conf`) proxy `/api/*` sang `api-gateway`, dev vite `server.proxy` (`vite.config.ts`)
proxy tương tự — cả 2 đều dùng `VITE_BASE_URL=/api` (path tương đối), không cần CORS (xem
[`docs/architecture.md`](./docs/architecture.md)). Chạy được đủ cả cụm hệ thống ở local — xem
[`api-sso/docs/local_dev.md`](../api-sso/docs/local_dev.md).

## Chạy dev

```bash
pnpm dev
```

Mặc định chạy ở `http://localhost:5173`, proxy `/api` sang `http://localhost:6688` (sửa target trong
`vite.config.ts` nếu gateway local chạy port khác).

## Build

```bash
pnpm build
```

## Typecheck

```bash
pnpm typecheck
```

Không có eslint/prettier riêng cho service này — chỉ `tsc` kiểm tra kiểu.

## Thu phóng chữ

- Chế độ `standard`/`large` dùng chung cookie `xdhy_font_size` với `task-web`.
- CSS nội bộ khai báo cỡ chữ bằng `rem`; chế độ `large` tăng `font-size` gốc theo cùng tỷ lệ `16/13`
  với token Ant Design. Không dùng `font-size: ...px` hoặc `fontSize` dạng số trong component mới vì
  các giá trị đó không phản ứng theo chế độ chữ lớn.

## Docker

Không có `docker-compose.yml` riêng cho service này — chạy cùng cụm ở gốc repo:

```bash
docker compose -f ../docker-compose.real.yml up -d --build sso-web
```

## Tài liệu dự án

- [`docs/architecture.md`](./docs/architecture.md) — Kiến trúc, vị trí trong hệ thống, cấu trúc `src/`
- [`docs/api.md`](./docs/api.md) — API mà FE gọi (đăng nhập, hồ sơ, danh sách app, quản trị app)
- [`docs/database.md`](./docs/database.md) — Vì sao không có DB riêng, trỏ sang doc schema backend
  (`api-sso/docs/database.md`)
- [`docs/technical_decisions.md`](./docs/technical_decisions.md) — Quyết định kỹ thuật + lý do (vì sao
  app độc lập không phục vụ qua gateway, cookie domain cha, phân quyền ứng dụng theo người...)
- [`../api-sso/docs/local_dev.md`](../api-sso/docs/local_dev.md) — Chạy cả cụm hệ thống (7 service) ở
  môi trường local, không chỉ riêng `sso-web`
