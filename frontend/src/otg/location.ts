/**
 * pktflow's implementation-specific `Port.location` format:
 * `"<pci>"` or `"<pci>?rxq=N&txq=N&rxd=N"` (any subset of the parameters).
 */

/** Daemon defaults applied to parameters missing from a location. */
export const DEFAULT_RXQ = 1
export const DEFAULT_TXQ = 1
export const DEFAULT_RXD = 1024

export interface PortLocation {
  pci: string
  rxq: number
  txq: number
  /** Number of descriptors in each rx queue's ring. */
  rxd: number
}

/** Formats a location in the daemon's canonical form (all parameters present). */
export function formatLocation({ pci, rxq, txq, rxd }: PortLocation): string {
  return `${pci}?rxq=${rxq}&txq=${txq}&rxd=${rxd}`
}

/**
 * Parses a location for display. Unknown or malformed parameters are ignored
 * (the daemon already validated the location when it was configured).
 */
export function parseLocation(location: string): PortLocation {
  const [pci, query = ''] = location.split('?', 2)
  const params = new URLSearchParams(query)
  const num = (key: string, fallback: number): number => {
    const n = Number(params.get(key))
    return params.has(key) && Number.isInteger(n) ? n : fallback
  }
  return {
    pci,
    rxq: num('rxq', DEFAULT_RXQ),
    txq: num('txq', DEFAULT_TXQ),
    rxd: num('rxd', DEFAULT_RXD),
  }
}
