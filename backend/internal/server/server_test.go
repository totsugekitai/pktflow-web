package server

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/totsugekitai/pktflow-web/backend/internal/daemon"
	"github.com/totsugekitai/pktflow-web/backend/internal/host"
)

// newServer builds a Server whose local host points at daemonURL.
func newServer(daemonURL string) http.Handler {
	return New(host.NewStore(daemonURL), daemon.NewClient(5*time.Second)).Handler()
}

func TestHealthz(t *testing.T) {
	rec := httptest.NewRecorder()
	newServer("http://127.0.0.1:7878").ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/healthz", nil))

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d", rec.Code, http.StatusOK)
	}
	if ct := rec.Header().Get("Content-Type"); ct != "application/json" {
		t.Fatalf("Content-Type = %q, want application/json", ct)
	}
}
