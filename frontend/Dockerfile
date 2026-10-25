# Web image: builds the Angular app and serves it with nginx, which also proxies /api and /swagger
# to the API container.
# Build context is the REPOSITORY ROOT, because the docs portal publishes ../docs and ../README.md:
#   docker build -f frontend/Dockerfile .

FROM node:22-alpine AS build
WORKDIR /src/frontend

# Dependencies first, so this layer is cached until package*.json change.
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci

COPY frontend/ ./
COPY docs/ /src/docs/
COPY README.md /src/README.md
RUN npm run build

FROM nginx:alpine
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /src/frontend/dist/tictactoe-web/browser /usr/share/nginx/html
EXPOSE 80
