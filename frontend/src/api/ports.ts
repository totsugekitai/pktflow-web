/**
 * Typed request functions for each port endpoint. Every call is scoped to a
 * host id; the backend forwards it to that host's pktflow daemon.
 */

import { API_BASE, apiAck, apiBlob, apiFetch } from './client.ts'
import type { AddPortRequest, PortMode, PortStats, PortStatus, Stream } from './types.ts'

/** Base path of a host's ports collection. */
function portsBase(hostId: string): string {
  return `/hosts/${encodeURIComponent(hostId)}/ports`
}

/** Path of a single port, percent-encoding the PCI address. */
function portPath(hostId: string, pci: string, suffix = ''): string {
  return `${portsBase(hostId)}/${encodeURIComponent(pci)}${suffix}`
}

/** URL of a finished capture, suitable for a download link. */
export function pcapUrl(hostId: string, pci: string): string {
  return `${API_BASE}${portPath(hostId, pci, '/pcap')}`
}

export async function listPorts(hostId: string): Promise<PortStatus[]> {
  const { ports } = await apiFetch<{ ports: PortStatus[] }>(portsBase(hostId))
  return ports
}

export function getStats(hostId: string, pci: string): Promise<PortStats> {
  return apiFetch<PortStats>(portPath(hostId, pci, '/stats'))
}

export function addPort(hostId: string, req: AddPortRequest): Promise<void> {
  return apiAck(portsBase(hostId), { method: 'POST', body: req })
}

export function removePort(hostId: string, pci: string): Promise<void> {
  return apiAck(portPath(hostId, pci), { method: 'DELETE' })
}

export function setMode(hostId: string, pci: string, mode: PortMode): Promise<void> {
  return apiAck(portPath(hostId, pci, '/mode'), { method: 'PUT', body: mode })
}

export function startTx(hostId: string, pci: string, streams: Stream[]): Promise<void> {
  return apiAck(portPath(hostId, pci, '/tx/start'), { method: 'POST', body: { streams } })
}

export function stopTx(hostId: string, pci: string): Promise<void> {
  return apiAck(portPath(hostId, pci, '/tx/stop'), { method: 'POST' })
}

export function startRx(hostId: string, pci: string): Promise<void> {
  return apiAck(portPath(hostId, pci, '/rx/start'), { method: 'POST' })
}

export function stopRx(hostId: string, pci: string): Promise<void> {
  return apiAck(portPath(hostId, pci, '/rx/stop'), { method: 'POST' })
}

export function startPcap(hostId: string, pci: string): Promise<void> {
  return apiAck(portPath(hostId, pci, '/pcap/start'), { method: 'POST' })
}

export function stopPcap(hostId: string, pci: string): Promise<void> {
  return apiAck(portPath(hostId, pci, '/pcap/stop'), { method: 'POST' })
}

export function downloadPcap(hostId: string, pci: string): Promise<Blob> {
  return apiBlob(portPath(hostId, pci, '/pcap'))
}
