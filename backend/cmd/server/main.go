// Command server is the pktflow-web backend. It sits between the browser UI
// and the pktflow daemon: it manages the set of daemon hosts the UI can target
// and forwards per-port operations to the selected host's daemon.
package main

import (
	"log"
	"net/http"
	"os"
	"time"

	"github.com/totsugekitai/pktflow-web/backend/internal/daemon"
	"github.com/totsugekitai/pktflow-web/backend/internal/host"
	"github.com/totsugekitai/pktflow-web/backend/internal/server"
)

func main() {
	addr := envOr("PKTFLOW_WEB_ADDR", ":8080")
	daemonAddr := envOr("PKTFLOW_DAEMON_ADDR", "http://127.0.0.1:7878")
	// Set to the built frontend's directory to serve the UI from this backend
	// (the container setup). Left unset in dev, where Vite serves the UI.
	staticDir := os.Getenv("PKTFLOW_WEB_STATIC_DIR")

	hosts := host.NewStore(daemonAddr)
	client := daemon.NewClient(30 * time.Second)
	srv := server.New(hosts, client, server.WithStaticDir(staticDir))

	log.Printf("pktflow-web backend listening on %s (local daemon %s)", addr, daemonAddr)
	if err := http.ListenAndServe(addr, srv.Handler()); err != nil {
		log.Fatalf("server stopped: %v", err)
	}
}

// envOr returns the environment variable named key, or fallback when it is unset
// or empty.
func envOr(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
