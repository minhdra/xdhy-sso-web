FROM node:22-alpine AS build-stage
WORKDIR /app
COPY package.json pnpm-lock.yaml* ./
RUN npm i -g pnpm@10
RUN pnpm i --no-frozen-lockfile
COPY . .

# Domain cha dùng chung, cho phép redirect sau login về app khác cùng domain
# (build-web...) - rỗng thì chỉ nhận redirect dạng path nội bộ. Phải khai ARG
# rồi promote sang ENV mới có mặt lúc build (đã gặp lỗi thật y hệt ở
# build-web/Dockerfile khi quên bước này).
ARG VITE_ALLOWED_REDIRECT_SUFFIX
ENV VITE_ALLOWED_REDIRECT_SUFFIX=$VITE_ALLOWED_REDIRECT_SUFFIX
# URL tuyệt đối của api-gateway - sso-web giờ là frontend app độc lập (port
# riêng), gọi API cross-origin thật, không còn same-origin với gateway nữa.
ARG VITE_GATEWAY_URL
ENV VITE_GATEWAY_URL=$VITE_GATEWAY_URL
# Domain cha dùng chung - khi bấm toggle sáng/tối, ghi cookie theme_mode ở
# domain này để đồng bộ theme với build-web (và ngược lại). Rỗng -> cookie
# host-only, toggle vẫn chạy nhưng không lan sang app khác.
ARG VITE_COOKIE_DOMAIN
ENV VITE_COOKIE_DOMAIN=$VITE_COOKIE_DOMAIN
RUN pnpm run build

FROM nginx:1.27-alpine AS production-stage
COPY --from=build-stage /app/dist /usr/share/nginx/html
COPY config/default.conf /etc/nginx/conf.d/default.conf
CMD ["nginx", "-g", "daemon off;"]
