package host

import (
	"errors"
	"testing"
)

const localAddr = "http://127.0.0.1:7878"

func TestNewStoreSeedsLocal(t *testing.T) {
	s := NewStore(localAddr)
	hosts := s.List()
	if len(hosts) != 1 || hosts[0].ID != LocalID {
		t.Fatalf("expected only the local host, got %+v", hosts)
	}
	if hosts[0].Address != localAddr {
		t.Fatalf("local address = %q", hosts[0].Address)
	}
}

func TestAddAndGet(t *testing.T) {
	s := NewStore(localAddr)
	h := s.Add("rack-2", "http://10.0.0.2:7878")
	if h.ID == "" || h.ID == LocalID {
		t.Fatalf("unexpected id %q", h.ID)
	}
	got, ok := s.Get(h.ID)
	if !ok || got != h {
		t.Fatalf("Get(%q) = %+v, %v", h.ID, got, ok)
	}
	if len(s.List()) != 2 {
		t.Fatalf("expected 2 hosts, got %d", len(s.List()))
	}
}

func TestRemove(t *testing.T) {
	s := NewStore(localAddr)
	h := s.Add("rack-2", "http://10.0.0.2:7878")
	if err := s.Remove(h.ID); err != nil {
		t.Fatalf("Remove: %v", err)
	}
	if _, ok := s.Get(h.ID); ok {
		t.Fatal("host still present after removal")
	}
}

func TestRemoveBuiltin(t *testing.T) {
	s := NewStore(localAddr)
	if err := s.Remove(LocalID); !errors.Is(err, ErrBuiltin) {
		t.Fatalf("Remove(local) = %v, want ErrBuiltin", err)
	}
}

func TestRemoveUnknown(t *testing.T) {
	s := NewStore(localAddr)
	if err := s.Remove("nope"); !errors.Is(err, ErrNotFound) {
		t.Fatalf("Remove(nope) = %v, want ErrNotFound", err)
	}
}
