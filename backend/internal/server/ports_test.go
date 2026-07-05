package server

import (
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestProxyListPorts(t *testing.T) {
	ds := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet || r.URL.Path != "/ports" {
			t.Errorf("daemon got %s %s", r.Method, r.URL.Path)
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = io.WriteString(w, `{"ports":[]}`)
	}))
	defer ds.Close()

	rec := httptest.NewRecorder()
	newServer(ds.URL).ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/api/hosts/local/ports", nil))

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d", rec.Code)
	}
	if got := strings.TrimSpace(rec.Body.String()); got != `{"ports":[]}` {
		t.Fatalf("body = %q", got)
	}
}

func TestProxyStats(t *testing.T) {
	const body = `{"pci":"0000:02:00.1","hw":{"rx_packets":1002},"sw":{"rx_frames":1002}}`
	ds := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet || !strings.HasSuffix(r.URL.EscapedPath(), "/stats") {
			t.Errorf("daemon got %s %s", r.Method, r.URL.EscapedPath())
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = io.WriteString(w, body)
	}))
	defer ds.Close()

	rec := httptest.NewRecorder()
	newServer(ds.URL).ServeHTTP(rec, httptest.NewRequest(
		http.MethodGet, "/api/hosts/local/ports/0000%3A02%3A00.1/stats", nil))

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d", rec.Code)
	}
	if got := strings.TrimSpace(rec.Body.String()); got != body {
		t.Fatalf("body = %q", got)
	}
}

func TestProxyForwardsBodyAndPCI(t *testing.T) {
	var gotPath, gotBody string
	ds := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotPath = r.URL.EscapedPath()
		b, _ := io.ReadAll(r.Body)
		gotBody = string(b)
		w.Header().Set("Content-Type", "application/json")
		_, _ = io.WriteString(w, `{"ok":true}`)
	}))
	defer ds.Close()

	rec := httptest.NewRecorder()
	req := httptest.NewRequest(
		http.MethodPost,
		"/api/hosts/local/ports/0000%3A02%3A00.0/tx/start",
		strings.NewReader(`{"streams":[]}`),
	)
	req.Header.Set("Content-Type", "application/json")
	newServer(ds.URL).ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, body %s", rec.Code, rec.Body.String())
	}
	if !strings.Contains(gotPath, "0000") || !strings.HasSuffix(gotPath, "/tx/start") {
		t.Fatalf("daemon path = %q", gotPath)
	}
	if gotBody != `{"streams":[]}` {
		t.Fatalf("daemon body = %q", gotBody)
	}
}

func TestProxyUnknownHost(t *testing.T) {
	rec := httptest.NewRecorder()
	newServer("http://127.0.0.1:7878").ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/api/hosts/nope/ports", nil))

	if rec.Code != http.StatusNotFound {
		t.Fatalf("status = %d, want 404", rec.Code)
	}
}

func TestProxyDaemonErrorPassthrough(t *testing.T) {
	ds := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusBadRequest)
		_, _ = io.WriteString(w, `{"error":"bad pci"}`)
	}))
	defer ds.Close()

	rec := httptest.NewRecorder()
	newServer(ds.URL).ServeHTTP(rec, httptest.NewRequest(http.MethodDelete, "/api/hosts/local/ports/xxx", nil))

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, want 400", rec.Code)
	}
	if !strings.Contains(rec.Body.String(), "bad pci") {
		t.Fatalf("body = %q", rec.Body.String())
	}
}
