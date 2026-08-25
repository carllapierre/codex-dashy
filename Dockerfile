FROM node:22-bookworm-slim AS dependencies

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends python3 make g++ \
    && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json

RUN npm ci

FROM dependencies AS build

COPY . .
RUN npm run build

FROM node:22-bookworm-slim AS runtime

WORKDIR /app
ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=8789
ENV DB_FILE=/app/data/codex-dashy.db
ENV WEB_DIST_DIR=/app/apps/web/dist

COPY --from=dependencies /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/apps/api/package.json ./apps/api/package.json
COPY --from=build /app/apps/api/dist ./apps/api/dist
COPY --from=build /app/apps/web/dist ./apps/web/dist

RUN mkdir -p /app/data

EXPOSE 8789
CMD ["node", "apps/api/dist/main.js"]
