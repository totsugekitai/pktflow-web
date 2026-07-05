# pktflow-web

Web UI for `pktflow` and its backend server.

This is a monorepo with two parts:

| Directory   | Stack                          | Role                                                        |
| ----------- | ------------------------------ | ---------------------------------------------------------- |
| `frontend/` | React + TypeScript (Vite)      | Browser UI. Talks **only** to the backend.                 |
| `backend/`  | Go (`net/http`)                | Sits between the frontend and the pktflow daemon.          |

```
browser ──► frontend (SPA) ──► backend (Go) ──► pktflow daemon (127.0.0.1:7878)
```

The frontend never calls the pktflow daemon directly; the Go backend is its sole
client.

**!!!Warning!!!**

These programs are largely written by Claude Code.

## Container

The whole app ships as a single image: a multi-stage `Dockerfile` builds the
frontend and the Go backend, and the backend serves the built UI from the same
origin as the API (`PKTFLOW_WEB_STATIC_DIR`).

```sh
docker compose up --build
```

The UI is then available at <http://localhost:8080>.

`docker-compose.yml` uses host networking so the backend can reach the pktflow
daemon on `127.0.0.1:7878` and the UI is exposed on the host's `:8080`. The
daemon itself runs on the host (it needs DPDK/hardware access) and is **not**
containerized. Point the backend elsewhere with `PKTFLOW_DAEMON_ADDR` if the
daemon listens on another address.

To build and run without Compose:

```sh
docker build -t pktflow-web .
docker run --network host pktflow-web
```

> Host networking is Linux-only. On other platforms, drop `network_mode: host`,
> publish the port with `-p 8080:8080`, and set
> `PKTFLOW_DAEMON_ADDR=http://host.docker.internal:7878`.

## Frontend

This project uses [pnpm](https://pnpm.io) (see `frontend/pnpm-lock.yaml`).

```sh
cd frontend
pnpm install
pnpm dev         # start the dev server
pnpm test        # Vitest
pnpm lint        # OxLint
pnpm build       # production build
```

See [`frontend/README.md`](frontend/README.md) for details.

## Backend

Requires Go (module targets `go 1.26.4`; with `GOTOOLCHAIN=auto` the matching
toolchain is fetched automatically).

```sh
cd backend
go run ./cmd/server   # start the server
go test ./...
go vet ./...
```

Configuration (environment variables):

| Variable                | Default                  | Purpose                                   |
| ----------------------- | ------------------------ | ----------------------------------------- |
| `PKTFLOW_WEB_ADDR`      | `:8080`                  | Address the backend listens on.           |
| `PKTFLOW_DAEMON_ADDR`   | `http://127.0.0.1:7878`  | Address of the built-in `local` host's daemon. |
| `PKTFLOW_WEB_STATIC_DIR`| _(unset)_                | Directory of the built frontend to serve at the same origin. Unset in dev (Vite serves the UI); set in the container. |

### Endpoints

All application routes are served under `/api`. Errors use the daemon-compatible
`{"error": "..."}` shape.

**Health**

| Method | Path       | Description                              |
| ------ | ---------- | ---------------------------------------- |
| GET    | `/healthz` | Liveness check, returns `{"status":"ok"}`. |

**Hosts** — a host is a pktflow daemon endpoint. Hosts are held in memory; the
built-in `local` host is seeded at startup and cannot be removed.

| Method | Path               | Description                                                        |
| ------ | ------------------ | ----------------------------------------------------------------- |
| GET    | `/api/hosts`       | List hosts. Returns `{"hosts":[{id,label,address}, …]}`.          |
| POST   | `/api/hosts`       | Add a host. Body `{label, address}`; returns the created host (201). |
| DELETE | `/api/hosts/{id}`  | Remove a host (204). The built-in `local` host is rejected (400).  |

**Ports** — forwarded verbatim to the selected host's daemon, which owns all port
state. `{pci}` is the port's PCI address (e.g. `0000:02:00.0`). See the daemon
REST API at `pktflow/doc/daemon_api.md` for request and
response bodies.

| Method | Path                                        | Description                          |
| ------ | ------------------------------------------- | ------------------------------------ |
| GET    | `/api/hosts/{id}/ports`                     | List the host's ports.               |
| POST   | `/api/hosts/{id}/ports`                     | Add a port.                          |
| DELETE | `/api/hosts/{id}/ports/{pci}`               | Remove a port.                       |
| PUT    | `/api/hosts/{id}/ports/{pci}/mode`          | Change the port mode.                |
| POST   | `/api/hosts/{id}/ports/{pci}/tx/start`      | Start transmit.                      |
| POST   | `/api/hosts/{id}/ports/{pci}/tx/stop`       | Stop transmit.                       |
| POST   | `/api/hosts/{id}/ports/{pci}/rx/start`      | Start receive.                       |
| POST   | `/api/hosts/{id}/ports/{pci}/rx/stop`       | Stop receive.                        |
| POST   | `/api/hosts/{id}/ports/{pci}/pcap/start`    | Start capture.                       |
| POST   | `/api/hosts/{id}/ports/{pci}/pcap/stop`     | Stop capture.                        |
| GET    | `/api/hosts/{id}/ports/{pci}/pcap`          | Download the finished capture (binary). |
