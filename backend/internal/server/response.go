package server

import (
	"encoding/json"
	"net/http"
)

// writeJSON encodes body as JSON with the given status code.
func writeJSON(w http.ResponseWriter, status int, body any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	// The status and headers are already committed; a failed encode (only
	// possible on a dropped connection here) leaves nothing more to do.
	_ = json.NewEncoder(w).Encode(body)
}

// writeError responds with the daemon-compatible {"error": "..."} shape so the
// frontend surfaces backend and daemon failures through the same path.
func writeError(w http.ResponseWriter, status int, msg string) {
	writeJSON(w, status, map[string]string{"error": msg})
}
