package server

import (
	"encoding/json"
	"errors"
	"net/http"
	"net/url"
	"strings"

	"github.com/totsugekitai/pktflow-web/backend/internal/host"
)

// handleListHosts returns every configured host, built-in local first.
func (s *Server) handleListHosts(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, map[string]any{"hosts": s.hosts.List()})
}

type addHostRequest struct {
	Label   string `json:"label"`
	Address string `json:"address"`
}

// handleAddHost registers a new daemon endpoint and returns the created host.
func (s *Server) handleAddHost(w http.ResponseWriter, r *http.Request) {
	var req addHostRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid JSON body")
		return
	}
	label := strings.TrimSpace(req.Label)
	if label == "" {
		writeError(w, http.StatusBadRequest, "label is required")
		return
	}
	address, err := normalizeAddress(req.Address)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	writeJSON(w, http.StatusCreated, s.hosts.Add(label, address))
}

// handleRemoveHost deletes a host; the built-in local host is protected.
func (s *Server) handleRemoveHost(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	switch err := s.hosts.Remove(id); {
	case errors.Is(err, host.ErrNotFound):
		writeError(w, http.StatusNotFound, "unknown host: "+id)
	case errors.Is(err, host.ErrBuiltin):
		writeError(w, http.StatusBadRequest, "the built-in local host cannot be removed")
	case err != nil:
		writeError(w, http.StatusInternalServerError, err.Error())
	default:
		w.WriteHeader(http.StatusNoContent)
	}
}

// normalizeAddress validates that v is an absolute http(s) URL the backend can
// reach and strips any trailing slash so it joins cleanly with daemon paths.
func normalizeAddress(v string) (string, error) {
	trimmed := strings.TrimSpace(v)
	if trimmed == "" {
		return "", errors.New("address is required")
	}
	u, err := url.Parse(trimmed)
	if err != nil || (u.Scheme != "http" && u.Scheme != "https") || u.Host == "" {
		return "", errors.New("address must be an http(s) URL, e.g. http://192.168.1.10:7878")
	}
	return strings.TrimRight(trimmed, "/"), nil
}
