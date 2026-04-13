FROM node:22-alpine AS build

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

RUN corepack enable

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY apps/landing/package.json apps/landing/package.json

RUN pnpm install --frozen-lockfile --filter landing...

COPY apps/landing apps/landing

RUN pnpm --filter landing build

FROM nginx:1.29-alpine AS runtime

COPY apps/landing/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/landing/dist /usr/share/nginx/html

EXPOSE 8080
