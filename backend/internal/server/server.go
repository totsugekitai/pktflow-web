// Package server wires the HTTP routes exposed to the pktflow-web frontend.
//
// The frontend talks only to this backend. Host management is served locally;
// Open Traffic Generator (OTG) API calls are forwarded verbatim to the selected
// host's pktflow daemon, which owns all port, flow, and capture state.
package server

import (
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"github.com/totsugekitai/pktflow-web/backend/internal/daemon"
	"github.com/totsugekitai/pktflow-web/backend/internal/host"
)

// Server holds the dependencies shared across HTTP handlers.
type Server struct {
	hosts  *host.Store
	daemon *daemon.Client
	// staticDir is the directory holding the built frontend. When empty the
	// backend serves the API only (the dev setup, where Vite serves the UI).
	staticDir string
}

// Option customizes a Server built by New.
type Option func(*Server)

// WithStaticDir makes the backend serve the built frontend from dir at the same
// origin as the API, with SPA fallback for client-side routes. Passing an empty
// dir leaves static serving disabled.
func WithStaticDir(dir string) Option {
	return func(s *Server) { s.staticDir = dir }
}

// New constructs a Server backed by the given host store and daemon client.
func New(hosts *host.Store, client *daemon.Client, opts ...Option) *Server {
	s := &Server{hosts: hosts, daemon: client}
	for _, opt := range opts {
		opt(s)
	}
	return s
}

// Handler builds the router for all backend routes.
func (s *Server) Handler() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /healthz", s.handleHealth)

	mux.HandleFunc("GET /api/hosts", s.handleListHosts)
	mux.HandleFunc("POST /api/hosts", s.handleAddHost)
	mux.HandleFunc("DELETE /api/hosts/{id}", s.handleRemoveHost)

	// Open Traffic Generator (OTG) endpoints are forwarded to the selected
	// host's daemon under the same path.
	for _, pattern := range []string{
		"GET /api/hosts/{id}/config",
		"POST /api/hosts/{id}/config",
		"POST /api/hosts/{id}/control/state",
		"POST /api/hosts/{id}/monitor/metrics",
		"POST /api/hosts/{id}/monitor/capture",
		"GET /api/hosts/{id}/capabilities/version",
	} {
		mux.HandleFunc(pattern, s.proxyToDaemon)
	}

	// When configured, serve the built frontend from the same origin. The API
	// and /healthz patterns above are more specific, so they take precedence
	// over this catch-all.
	if s.staticDir != "" {
		mux.Handle("GET /", spaFileServer(s.staticDir))
	}
	return mux
}

// handleHealth reports process liveness. It performs no downstream checks.
func (s *Server) handleHealth(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

// spaFileServer serves static assets from dir and falls back to index.html for
// any path that doesn't map to an existing file, so client-side routes resolve.
// Unknown /api paths are left as 404s rather than being masked by the SPA shell.
func spaFileServer(dir string) http.Handler {
	files := http.FileServer(http.Dir(dir))
	index := filepath.Join(dir, "index.html")
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if strings.HasPrefix(r.URL.Path, "/api/") {
			http.NotFound(w, r)
			return
		}
		// http.Dir already contains traversal; Clean+Join keeps the stat within
		// dir so a missing file (not an escape) triggers the SPA fallback.
		path := filepath.Join(dir, filepath.Clean(r.URL.Path))
		if info, err := os.Stat(path); err != nil || info.IsDir() {
			http.ServeFile(w, r, index)
			return
		}
		files.ServeHTTP(w, r)
	})
}
