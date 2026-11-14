# syntax=docker/dockerfile:1
FROM node:24-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

FROM node:24-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM node:24-alpine AS prod-deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund

FROM node:24-alpine AS run
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 UPLOAD_DIR=/data/uploads
RUN apk add --no-cache su-exec && addgroup -S app && adduser -S app -G app && mkdir -p /data/uploads && chown -R app:app /data
COPY --chown=app:app --from=prod-deps /app/node_modules ./node_modules
COPY --chown=app:app --from=build /app/.next ./.next
COPY --chown=app:app --from=build /app/public ./public
COPY --chown=app:app package.json next.config.ts ./
EXPOSE 3000
# Starts as root only to take ownership of the mounted volume (Railway mounts /data as root, which would make
# photo and bill uploads fail), then runs the app as the unprivileged "app" user. next start listens on $PORT.
CMD ["sh", "-c", "chown -R app:app /data 2>/dev/null; exec su-exec app node_modules/.bin/next start"]
