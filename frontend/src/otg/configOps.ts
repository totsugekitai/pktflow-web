/**
 * Pure transformations of an OTG {@link Config}, applied in a read-modify-write
 * cycle before `POST /config` (see `updateConfig`). Each returns a new config,
 * or the very same object when nothing needs to change. Violations the daemon
 * would reject anyway are thrown as {@link ConfigError} with a message tailored
 * to the UI action.
 */

import type { Capture, Config, Flow, Port } from '../api/types.ts'
import { parseLocation } from './location.ts'

export class ConfigError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ConfigError'
  }
}

/** Names of the ports a flow transmits from or receives on. */
export function flowPortNames(flow: Flow): string[] {
  const port = flow.tx_rx.port
  return port === null ? [] : [port.tx_name, ...port.rx_names]
}

export function addPort(config: Config, port: Port): Config {
  if (config.ports.some((p) => p.name === port.name)) {
    throw new ConfigError(`A port named "${port.name}" already exists`)
  }
  const pci = parseLocation(port.location).pci
  const clash = config.ports.find((p) => parseLocation(p.location).pci === pci)
  if (clash !== undefined) {
    throw new ConfigError(`PCI ${pci} is already configured as port "${clash.name}"`)
  }
  return { ...config, ports: [...config.ports, port] }
}

/**
 * Removes a port and drops it from every capture (removing captures left with
 * no ports). Refuses while a flow still uses the port, since silently deleting
 * user-defined flows would be surprising.
 */
export function removePort(config: Config, name: string): Config {
  const users = config.flows.filter((f) => flowPortNames(f).includes(name)).map((f) => f.name)
  if (users.length > 0) {
    throw new ConfigError(
      `Port "${name}" is used by flow(s) ${users.map((n) => `"${n}"`).join(', ')}; remove or edit them first`,
    )
  }
  const captures = config.captures
    .map((c) => ({ ...c, port_names: c.port_names.filter((p) => p !== name) }))
    .filter((c) => c.port_names.length > 0)
  return { ...config, ports: config.ports.filter((p) => p.name !== name), captures }
}

/** Returns `base`, or `base-2`, `base-3`, … — the first name not in `taken`. */
function uniqueName(base: string, taken: ReadonlySet<string>): string {
  if (!taken.has(base)) return base
  let i = 2
  while (taken.has(`${base}-${i}`)) i++
  return `${base}-${i}`
}

/**
 * Ensures some capture covers the port (the daemon refuses to start a capture
 * on a port no capture references), adding a dedicated one if needed.
 */
export function ensureCapture(config: Config, portName: string): Config {
  if (config.captures.some((c) => c.port_names.includes(portName))) return config
  const capture: Capture = {
    name: uniqueName(`capture-${portName}`, new Set(config.captures.map((c) => c.name))),
    port_names: [portName],
    format: 'pcapng',
  }
  return { ...config, captures: [...config.captures, capture] }
}

/**
 * Adds a flow, or replaces the flow named `originalName` (which may differ
 * from `flow.name` when the flow is being renamed) in place.
 */
export function saveFlow(config: Config, flow: Flow, originalName?: string): Config {
  const duplicate = config.flows.some((f) => f.name === flow.name && f.name !== originalName)
  if (duplicate) {
    throw new ConfigError(`A flow named "${flow.name}" already exists`)
  }
  if (originalName === undefined) {
    return { ...config, flows: [...config.flows, flow] }
  }
  if (!config.flows.some((f) => f.name === originalName)) {
    throw new ConfigError(`Flow "${originalName}" no longer exists`)
  }
  return { ...config, flows: config.flows.map((f) => (f.name === originalName ? flow : f)) }
}

export function removeFlow(config: Config, name: string): Config {
  return { ...config, flows: config.flows.filter((f) => f.name !== name) }
}
