package server

import (
	"bytes"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestProxyGetConfig(t *testing.T) {
	ds := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet || r.URL.Path != "/config" {
			t.Errorf("daemon got %s %s", r.Method, r.URL.Path)
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = io.WriteString(w, `{"ports":[],"captures":[],"flows":[]}`)
	}))
	defer ds.Close()

	rec := httptest.NewRecorder()
	newServer(ds.URL).ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/api/hosts/local/config", nil))

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d", rec.Code)
	}
	if got := strings.TrimSpace(rec.Body.String()); got != `{"ports":[],"captures":[],"flows":[]}` {
		t.Fatalf("body = %q", got)
	}
}

func TestProxyForwardsBodyAndPath(t *testing.T) {
	tests := []struct {
		name string
		path string
		body string
	}{
		{"set config", "/config", `{"ports":[{"name":"p1","location":"0000:02:00.0"}]}`},
		{"control state", "/control/state", `{"choice":"port","port":{"choice":"link","link":{"port_names":["p1"],"state":"up"}}}`},
		{"monitor metrics", "/monitor/metrics", `{"choice":"port","port":{"port_names":[]}}`},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			var gotMethod, gotPath, gotBody, gotType string
			ds := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				gotMethod = r.Method
				gotPath = r.URL.Path
				gotType = r.Header.Get("Content-Type")
				b, _ := io.ReadAll(r.Body)
				gotBody = string(b)
				w.Header().Set("Content-Type", "application/json")
				_, _ = io.WriteString(w, `{"warnings":[]}`)
			}))
			defer ds.Close()

			rec := httptest.NewRecorder()
			req := httptest.NewRequest(http.MethodPost, "/api/hosts/local"+tt.path, strings.NewReader(tt.body))
			req.Header.Set("Content-Type", "application/json")
			newServer(ds.URL).ServeHTTP(rec, req)

			if rec.Code != http.StatusOK {
				t.Fatalf("status = %d, body %s", rec.Code, rec.Body.String())
			}
			if gotMethod != http.MethodPost || gotPath != tt.path {
				t.Fatalf("daemon got %s %s, want POST %s", gotMethod, gotPath, tt.path)
			}
			if gotBody != tt.body {
				t.Fatalf("daemon body = %q", gotBody)
			}
			if gotType != "application/json" {
				t.Fatalf("daemon Content-Type = %q", gotType)
			}
		})
	}
}

func TestProxyCaptureIsBinary(t *testing.T) {
	pcap := []byte{0x0a, 0x0d, 0x0d, 0x0a, 0x00, 0xff}
	ds := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost || r.URL.Path != "/monitor/capture" {
			t.Errorf("daemon got %s %s", r.Method, r.URL.Path)
		}
		w.Header().Set("Content-Type", "application/octet-stream")
		_, _ = w.Write(pcap)
	}))
	defer ds.Close()

	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/api/hosts/local/monitor/capture", strings.NewReader(`{"port_name":"p1"}`))
	newServer(ds.URL).ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d", rec.Code)
	}
	if ct := rec.Header().Get("Content-Type"); ct != "application/octet-stream" {
		t.Fatalf("Content-Type = %q", ct)
	}
	if !bytes.Equal(rec.Body.Bytes(), pcap) {
		t.Fatalf("body = %v", rec.Body.Bytes())
	}
}

func TestProxyUnknownHost(t *testing.T) {
	rec := httptest.NewRecorder()
	newServer("http://127.0.0.1:7878").ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/api/hosts/nope/config", nil))

	if rec.Code != http.StatusNotFound {
		t.Fatalf("status = %d, want 404", rec.Code)
	}
}

func TestProxyRejectsUnlistedPath(t *testing.T) {
	rec := httptest.NewRecorder()
	newServer("http://127.0.0.1:7878").ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/api/hosts/local/ports", nil))

	if rec.Code != http.StatusNotFound {
		t.Fatalf("status = %d, want 404", rec.Code)
	}
}

func TestProxyDaemonErrorPassthrough(t *testing.T) {
	const otgError = `{"code":400,"kind":"validation","errors":["no such port \"p9\""]}`
	ds := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusBadRequest)
		_, _ = io.WriteString(w, otgError)
	}))
	defer ds.Close()

	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/api/hosts/local/control/state", strings.NewReader(`{}`))
	newServer(ds.URL).ServeHTTP(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, want 400", rec.Code)
	}
	if got := strings.TrimSpace(rec.Body.String()); got != otgError {
		t.Fatalf("body = %q", got)
	}
}
