package host

import (
	"errors"
	"strconv"
	"sync"
)

// LocalID is the id of the built-in host that targets the local daemon. It is
// seeded at startup and cannot be removed.
const LocalID = "local"

var (
	// ErrNotFound is returned when no host has the given id.
	ErrNotFound = errors.New("host not found")
	// ErrBuiltin is returned when removal of the built-in local host is attempted.
	ErrBuiltin = errors.New("built-in host cannot be removed")
)

// Store is an in-memory, concurrency-safe set of hosts. Hosts are not persisted;
// only the built-in local host survives a restart.
type Store struct {
	mu    sync.RWMutex
	hosts map[string]*Host
	order []string
	seq   int
}

// NewStore returns a Store seeded with the built-in local host pointing at
// localAddress.
func NewStore(localAddress string) *Store {
	local := &Host{ID: LocalID, Label: "Local", Address: localAddress}
	return &Store{
		hosts: map[string]*Host{LocalID: local},
		order: []string{LocalID},
	}
}

// List returns all hosts in insertion order.
func (s *Store) List() []Host {
	s.mu.RLock()
	defer s.mu.RUnlock()
	out := make([]Host, 0, len(s.order))
	for _, id := range s.order {
		out = append(out, *s.hosts[id])
	}
	return out
}

// Get returns the host with the given id.
func (s *Store) Get(id string) (Host, bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	h, ok := s.hosts[id]
	if !ok {
		return Host{}, false
	}
	return *h, true
}

// Add stores a new host with a generated id and returns it.
func (s *Store) Add(label, address string) Host {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.seq++
	h := &Host{ID: "host-" + strconv.Itoa(s.seq), Label: label, Address: address}
	s.hosts[h.ID] = h
	s.order = append(s.order, h.ID)
	return *h
}

// Remove deletes a host. The built-in local host cannot be removed.
func (s *Store) Remove(id string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if id == LocalID {
		return ErrBuiltin
	}
	if _, ok := s.hosts[id]; !ok {
		return ErrNotFound
	}
	delete(s.hosts, id)
	for i, existing := range s.order {
		if existing == id {
			s.order = append(s.order[:i], s.order[i+1:]...)
			break
		}
	}
	return nil
}
