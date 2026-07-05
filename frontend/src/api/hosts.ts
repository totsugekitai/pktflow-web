/** Typed request functions for the backend's host-management endpoints. */

import { apiFetch, apiVoid } from './client.ts'
import type { AddHostRequest, Host } from './types.ts'

/** Id of the built-in host the backend seeds; it cannot be removed. */
export const LOCAL_HOST_ID = 'local'

export async function listHosts(): Promise<Host[]> {
  const { hosts } = await apiFetch<{ hosts: Host[] }>('/hosts')
  return hosts
}

export function addHost(req: AddHostRequest): Promise<Host> {
  return apiFetch<Host>('/hosts', { method: 'POST', body: req })
}

export function removeHost(id: string): Promise<void> {
  return apiVoid(`/hosts/${encodeURIComponent(id)}`, { method: 'DELETE' })
}
