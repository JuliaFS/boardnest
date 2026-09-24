# syntax=docker/dockerfile:1.7

ARG NODE_VERSION=24.21.0
ARG PNPM_VERSION=12.4.2

FROM node:${NODE_VERSION}-alpine AS base
ARG PNPM_VERSION
ENV PNPM_HOME=/pnpm
ENV PATH=${PNPM_HOME}:${PATH}
RUN corepack enable && corepack prepare pnpm@${PNPM_VERSION} --activate
WORKDIR /workspace

FROM base AS dependencies
COPY . .
RUN --mount=type=cache,id=boardnest-pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile

FROM dependencies AS web-build
ARG VITE_API_URL=http://localhost:4000
ARG VITE_GRAPHQL_URL=http://localhost:4000/graphql
ARG VITE_WS_URL=ws://localhost:4000/graphql
ENV VITE_API_URL=${VITE_API_URL}
ENV VITE_GRAPHQL_URL=${VITE_GRAPHQL_URL}
ENV VITE_WS_URL=${VITE_WS_URL}
RUN pnpm --filter @boardnest/web build

FROM nginx:1.28-alpine AS web-runtime
COPY docker/nginx.conf /etc/nginx/nginx.conf
COPY --from=web-build /workspace/apps/web/dist /usr/share/nginx/html
USER nginx
EXPOSE 8080
HEALTHCHECK --interval=10s --timeout=3s --start-period=5s --retries=5 \
  CMD wget -q -O /dev/null http://127.0.0.1:8080/health || exit 1
ENTRYPOINT []
CMD ["nginx", "-g", "daemon off;"]

# Keep the API runtime as the final stage so Railway's default root-Dockerfile
# build deploys the backend. Docker Compose selects both targets explicitly.
FROM dependencies AS api-build
RUN pnpm --filter @boardnest/api build
RUN pnpm --filter @boardnest/api deploy --prod /prod/api

FROM node:${NODE_VERSION}-alpine AS api-runtime
ENV NODE_ENV=production
ENV PORT=4000
WORKDIR /app
COPY --from=api-build --chown=node:node /prod/api ./
USER node
EXPOSE 4000
HEALTHCHECK --interval=10s --timeout=3s --start-period=10s --retries=5 \
  CMD wget -q -O /dev/null "http://127.0.0.1:${PORT}/health" || exit 1
CMD ["node", "dist/server.js"]
