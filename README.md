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

`sso-web` gọi API cross-origin thẳng sang `api-gateway` (không qua vite dev proxy như `build-web`/
`task-web`) — cần `api-gateway` đã cấu hình `SSO_ORIGIN` trỏ đúng origin của `sso-web` (mặc định
`http://localhost:5173`), nếu không sẽ dính lỗi CORS. Chạy được đủ cả cụm hệ thống ở local — xem
[`api-sso/docs/local_dev.md`](../api-sso/docs/local_dev.md).

## Chạy dev

```bash
pnpm dev
```

Mặc định chạy ở `http://localhost:5173`, gọi API qua `VITE_GATEWAY_URL` (mặc định
`http://localhost:6688`).

## Build

```bash
pnpm build
```

## Typecheck

```bash
pnpm typecheck
```

Không có eslint/prettier riêng cho service này — chỉ `tsc` kiểm tra kiểu.

## Docker

Không có `docker-compose.yml` riêng cho service này — chạy cùng cụm sandbox ở gốc repo:

```bash
docker compose -f ../docker-compose.sso-sandbox.yml up -d --build sso-web-sandbox
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
