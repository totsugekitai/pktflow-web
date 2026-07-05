package server

import (
	"io"
	"net/http"
	"strings"
)

// proxyToDaemon forwards a port request to the selected host's daemon, streaming
// the daemon's status, body, and relevant headers straight back. The daemon owns
// all port state; the backend only routes to the right endpoint.
func (s *Server) proxyToDaemon(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	h, ok := s.hosts.Get(id)
	if !ok {
		writeError(w, http.StatusNotFound, "unknown host: "+id)
		return
	}

	// Everything past /api/hosts/{id} is the daemon path. EscapedPath keeps the
	// PCI address percent-encoded exactly as the daemon expects it.
	prefix := "/api/hosts/" + id
	daemonPath := strings.TrimPrefix(r.URL.EscapedPath(), prefix)
	if !strings.HasPrefix(daemonPath, "/ports") {
		writeError(w, http.StatusInternalServerError, "could not derive daemon path")
		return
	}

	resp, err := s.daemon.Do(r.Context(), r.Method, h.Address+daemonPath, r.Body, r.Header.Get("Content-Type"))
	if err != nil {
		writeError(w, http.StatusBadGateway, "daemon request failed: "+err.Error())
		return
	}
	defer resp.Body.Close()

	for _, key := range []string{"Content-Type", "Content-Disposition"} {
		if v := resp.Header.Get(key); v != "" {
			w.Header().Set(key, v)
		}
	}
	w.WriteHeader(resp.StatusCode)
	_, _ = io.Copy(w, resp.Body)
}
