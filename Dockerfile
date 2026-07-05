# syntax=docker/dockerfile:1

# --- Stage 1: build the frontend into static assets ---
FROM node:22-alpine AS frontend
WORKDIR /app/frontend
# The project is managed with pnpm; corepack picks the version from the
# "packageManager" field in package.json (copied below).
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN corepack enable
# Install deps first so this layer caches unless the lockfile changes.
COPY frontend/package.json frontend/pnpm-lock.yaml frontend/pnpm-workspace.yaml ./
# --ignore-scripts skips dependency build scripts; the only one is msw's (a
# test-only service worker) which the production build doesn't need, and it
# avoids pnpm's non-zero exit on that intentionally ignored build.
RUN pnpm install --frozen-lockfile --ignore-scripts
COPY frontend/ ./
RUN pnpm run build

# --- Stage 2: build the Go backend as a static binary ---
FROM golang:1.26-alpine AS backend
WORKDIR /app/backend
# The module is stdlib-only; copying go.mod first keeps the layer cached.
COPY backend/go.mod ./
RUN go mod download
COPY backend/ ./
RUN CGO_ENABLED=0 GOOS=linux go build -trimpath -o /pktflow-web ./cmd/server

# --- Stage 3: minimal runtime ---
FROM gcr.io/distroless/static-debian12:nonroot
WORKDIR /app
COPY --from=backend /pktflow-web /app/pktflow-web
COPY --from=frontend /app/frontend/dist /app/web
# Serve the built UI from the same origin as the API.
ENV PKTFLOW_WEB_STATIC_DIR=/app/web \
    PKTFLOW_WEB_ADDR=:8080
EXPOSE 8080
USER nonroot:nonroot
ENTRYPOINT ["/app/pktflow-web"]
