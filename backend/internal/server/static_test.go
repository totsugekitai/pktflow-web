package server

import (
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/totsugekitai/pktflow-web/backend/internal/daemon"
	"github.com/totsugekitai/pktflow-web/backend/internal/host"
)

// newStaticServer builds a Server that serves the built frontend from a temp
// dir seeded with an index and one asset.
func newStaticServer(t *testing.T) http.Handler {
	t.Helper()
	dir := t.TempDir()
	if err := os.WriteFile(filepath.Join(dir, "index.html"), []byte("<html>app</html>"), 0o644); err != nil {
		t.Fatalf("write index: %v", err)
	}
	if err := os.WriteFile(filepath.Join(dir, "app.js"), []byte("console.log(1)"), 0o644); err != nil {
		t.Fatalf("write asset: %v", err)
	}
	srv := New(host.NewStore("http://127.0.0.1:7878"), daemon.NewClient(5*time.Second), WithStaticDir(dir))
	return srv.Handler()
}

func TestStaticServesIndexAtRoot(t *testing.T) {
	rec := httptest.NewRecorder()
	newStaticServer(t).ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/", nil))

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d", rec.Code, http.StatusOK)
	}
	if body := rec.Body.String(); body != "<html>app</html>" {
		t.Fatalf("body = %q, want the index", body)
	}
}

func TestStaticServesExistingAsset(t *testing.T) {
	rec := httptest.NewRecorder()
	newStaticServer(t).ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/app.js", nil))

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d", rec.Code, http.StatusOK)
	}
	if body := rec.Body.String(); body != "console.log(1)" {
		t.Fatalf("body = %q, want the asset", body)
	}
}

func TestStaticFallsBackToIndexForClientRoute(t *testing.T) {
	rec := httptest.NewRecorder()
	newStaticServer(t).ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/hosts/local/ports", nil))

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d", rec.Code, http.StatusOK)
	}
	if body := rec.Body.String(); body != "<html>app</html>" {
		t.Fatalf("body = %q, want the index (SPA fallback)", body)
	}
}

func TestStaticLeavesUnknownAPIPathAs404(t *testing.T) {
	rec := httptest.NewRecorder()
	newStaticServer(t).ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/api/does-not-exist", nil))

	if rec.Code != http.StatusNotFound {
		t.Fatalf("status = %d, want %d", rec.Code, http.StatusNotFound)
	}
}

func TestNoStaticDirLeavesRootUnrouted(t *testing.T) {
	// Without a static dir the catch-all is not registered, so `/` is a 404.
	srv := New(host.NewStore("http://127.0.0.1:7878"), daemon.NewClient(5*time.Second))
	rec := httptest.NewRecorder()
	srv.Handler().ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/", nil))

	if rec.Code != http.StatusNotFound {
		t.Fatalf("status = %d, want %d", rec.Code, http.StatusNotFound)
	}
}
