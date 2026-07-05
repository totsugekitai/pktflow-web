// Package host tracks the pktflow daemon endpoints the UI can target.
package host

// Host is a pktflow daemon endpoint. Address is an absolute http(s) origin such
// as "http://127.0.0.1:7878".
type Host struct {
	ID      string `json:"id"`
	Label   string `json:"label"`
	Address string `json:"address"`
}
