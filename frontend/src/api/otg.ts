/**
 * Typed request functions for the OTG endpoints. Every call is scoped to a host
 * id; the backend forwards it to that host's pktflow daemon under the same path.
 */

import { apiBlob, apiFetch } from './client.ts'
import type {
  Config,
  ControlState,
  FlowMetric,
  MetricsRequest,
  MetricsResponse,
  PortMetric,
  WarningResponse,
} from './types.ts'

function hostPath(hostId: string, path: string): string {
  return `/hosts/${encodeURIComponent(hostId)}${path}`
}

/**
 * Reads the daemon's config, normalizing the list fields so callers never see
 * them missing.
 */
export async function getConfig(hostId: string): Promise<Config> {
  const config = await apiFetch<Partial<Config>>(hostPath(hostId, '/config'))
  return {
    ports: config.ports ?? [],
    captures: config.captures ?? [],
    flows: config.flows ?? [],
  }
}

/** Replaces the daemon's whole config. Resolves to the daemon's warnings. */
export async function setConfig(hostId: string, config: Config): Promise<string[]> {
  const { warnings } = await apiFetch<WarningResponse>(hostPath(hostId, '/config'), {
    method: 'POST',
    body: config,
  })
  return warnings
}

/**
 * Read-modify-write of the config: fetches the current config, applies
 * `transform`, and posts the result. `transform` returning the very same object
 * means "nothing to change" and skips the POST. Errors thrown by `transform`
 * propagate unchanged.
 */
export async function updateConfig(
  hostId: string,
  transform: (config: Config) => Config,
): Promise<string[]> {
  const current = await getConfig(hostId)
  const next = transform(current)
  return next === current ? [] : setConfig(hostId, next)
}

/** Applies a port link/capture or flow transmit state change. */
export async function setControlState(hostId: string, state: ControlState): Promise<string[]> {
  const { warnings } = await apiFetch<WarningResponse>(hostPath(hostId, '/control/state'), {
    method: 'POST',
    body: state,
  })
  return warnings
}

function getMetrics(hostId: string, req: MetricsRequest): Promise<MetricsResponse> {
  return apiFetch<MetricsResponse>(hostPath(hostId, '/monitor/metrics'), {
    method: 'POST',
    body: req,
  })
}

/** Metrics of the named ports, or of every port when `names` is empty. */
export async function getPortMetrics(hostId: string, names: string[] = []): Promise<PortMetric[]> {
  const res = await getMetrics(hostId, { choice: 'port', port: { port_names: names } })
  return res.port_metrics ?? []
}

/** Metrics of the named flows, or of every flow when `names` is empty. */
export async function getFlowMetrics(hostId: string, names: string[] = []): Promise<FlowMetric[]> {
  const res = await getMetrics(hostId, { choice: 'flow', flow: { flow_names: names } })
  return res.flow_metrics ?? []
}

/**
 * Fetches the port's most recent capture as pcapng. The daemon stops the
 * capture first if it is still running.
 */
export function getCapture(hostId: string, portName: string): Promise<Blob> {
  return apiBlob(hostPath(hostId, '/monitor/capture'), {
    method: 'POST',
    body: { port_name: portName },
  })
}
