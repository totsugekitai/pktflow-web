// Package daemon forwards HTTP requests to a pktflow daemon.
package daemon

import (
	"context"
	"io"
	"net/http"
	"time"
)

// Client forwards HTTP requests to a pktflow daemon.
type Client struct {
	http *http.Client
}

// NewClient returns a Client whose requests time out after the given duration.
func NewClient(timeout time.Duration) *Client {
	return &Client{http: &http.Client{Timeout: timeout}}
}

// Do issues a request to url, attaching body and Content-Type when present. The
// caller owns closing the returned response body.
func (c *Client) Do(ctx context.Context, method, url string, body io.Reader, contentType string) (*http.Response, error) {
	req, err := http.NewRequestWithContext(ctx, method, url, body)
	if err != nil {
		return nil, err
	}
	if contentType != "" {
		req.Header.Set("Content-Type", contentType)
	}
	return c.http.Do(req)
}
