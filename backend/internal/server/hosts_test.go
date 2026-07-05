package server

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestListHostsIncludesLocal(t *testing.T) {
	rec := httptest.NewRecorder()
	newServer("http://127.0.0.1:7878").ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/api/hosts", nil))

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d", rec.Code)
	}
	if !strings.Contains(rec.Body.String(), `"id":"local"`) {
		t.Fatalf("body = %q", rec.Body.String())
	}
}

func TestAddHostTrimsTrailingSlash(t *testing.T) {
	rec := httptest.NewRecorder()
	body := strings.NewReader(`{"label":"rack-2","address":"http://10.0.0.2:7878/"}`)
	newServer("http://127.0.0.1:7878").ServeHTTP(rec, httptest.NewRequest(http.MethodPost, "/api/hosts", body))

	if rec.Code != http.StatusCreated {
		t.Fatalf("status = %d, body %s", rec.Code, rec.Body.String())
	}
	if !strings.Contains(rec.Body.String(), `"address":"http://10.0.0.2:7878"`) {
		t.Fatalf("body = %q", rec.Body.String())
	}
}

func TestAddHostRejectsNonHTTPAddress(t *testing.T) {
	rec := httptest.NewRecorder()
	body := strings.NewReader(`{"label":"x","address":"ftp://x"}`)
	newServer("http://127.0.0.1:7878").ServeHTTP(rec, httptest.NewRequest(http.MethodPost, "/api/hosts", body))

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status = %d", rec.Code)
	}
}

func TestAddHostRequiresLabel(t *testing.T) {
	rec := httptest.NewRecorder()
	body := strings.NewReader(`{"label":"  ","address":"http://x:1"}`)
	newServer("http://127.0.0.1:7878").ServeHTTP(rec, httptest.NewRequest(http.MethodPost, "/api/hosts", body))

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status = %d", rec.Code)
	}
}

func TestRemoveLocalRejected(t *testing.T) {
	rec := httptest.NewRecorder()
	newServer("http://127.0.0.1:7878").ServeHTTP(rec, httptest.NewRequest(http.MethodDelete, "/api/hosts/local", nil))

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status = %d", rec.Code)
	}
}

func TestRemoveUnknownHost(t *testing.T) {
	rec := httptest.NewRecorder()
	newServer("http://127.0.0.1:7878").ServeHTTP(rec, httptest.NewRequest(http.MethodDelete, "/api/hosts/nope", nil))

	if rec.Code != http.StatusNotFound {
		t.Fatalf("status = %d", rec.Code)
	}
}
