import { setupServer } from 'msw/node'
import { http, HttpResponse } from 'msw'
import type { Host, PortStats, PortStatus } from '../api/types.ts'

/** A port with everything enabled and nothing running — a common baseline. */
export function makePort(overrides: Partial<PortStatus> = {}): PortStatus {
  return {
    pci: '0000:02:00.0',
    link_up: true,
    mode: { tx: true, rx: true, pcap: true },
    running: { tx: false, rx: false, pcap: false },
    pcap_ready: false,
    ...overrides,
  }
}

/** The built-in local host, as the backend reports it. */
export function makeHost(overrides: Partial<Host> = {}): Host {
  return { id: 'local', label: 'Local', address: 'http://127.0.0.1:7878', ...overrides }
}

/** A stats snapshot with all counters zeroed unless overridden. */
export function makeStats(overrides: Partial<PortStats> = {}): PortStats {
  return {
    pci: '0000:02:00.0',
    hw: {
      rx_packets: 0,
      tx_packets: 0,
      rx_bytes: 0,
      tx_bytes: 0,
      rx_missed: 0,
      rx_errors: 0,
      tx_errors: 0,
      rx_nombuf: 0,
    },
    sw: { tx_frames: 0, tx_bytes: 0, rx_frames: 0, rx_bytes: 0 },
    ...overrides,
  }
}

/**
 * Default handlers: a single local host and an empty port list. Tests override
 * per-case with `server.use`.
 */
export const defaultHandlers = [
  http.get('/api/hosts', () => HttpResponse.json({ hosts: [makeHost()] })),
  http.get('/api/hosts/:id/ports', () => HttpResponse.json({ ports: [] })),
  http.get('/api/hosts/:id/ports/:pci/stats', () => HttpResponse.json(makeStats())),
]

export const server = setupServer(...defaultHandlers)
