FROM node:20-alpine AS base
WORKDIR /app

# Зависимости
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/

RUN npm ci --ignore-scripts

# Исходники
COPY packages/shared/ packages/shared/
COPY apps/api/ apps/api/
COPY apps/web/ apps/web/

# Prisma generate
RUN npx prisma generate --schema=apps/api/prisma/schema.prisma

# Сборка shared (нужен для api в runtime)
RUN npm run build --workspace=packages/shared

# Сборка фронтенда
RUN npm run build:web

# Сборка бэкенда
RUN npm run build:api

# Продакшен образ
FROM node:20-alpine AS production
WORKDIR /app

COPY --from=base /app/package.json /app/package-lock.json ./
COPY --from=base /app/packages/shared/package.json packages/shared/
COPY --from=base /app/packages/shared/dist/ packages/shared/dist/
COPY --from=base /app/apps/api/package.json apps/api/
COPY --from=base /app/apps/api/dist/ apps/api/dist/
COPY --from=base /app/apps/api/prisma/ apps/api/prisma/
COPY --from=base /app/apps/web/dist/ apps/web/dist/
COPY --from=base /app/node_modules/ node_modules/

ENV NODE_ENV=production
EXPOSE 3000

CMD ["node", "apps/api/dist/index.js"]
