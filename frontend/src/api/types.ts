/**
 * Types mirroring the pktflow-web backend API (which in turn mirrors the
 * pktflow daemon REST API). See `pktflow/doc/daemon_api.md` and the Go backend
 * under `backend/`.
 */

/**
 * A pktflow daemon endpoint the backend can target. `address` is an absolute
 * http(s) origin such as `http://127.0.0.1:7878`. The built-in host has id
 * `local` and cannot be removed.
 */
export interface Host {
  id: string
  label: string
  address: string
}

/** Body of `POST /api/hosts`. */
export interface AddHostRequest {
  label: string
  address: string
}

/** Which task kinds a port permits. */
export interface PortMode {
  tx: boolean
  rx: boolean
  pcap: boolean
}

/** Which tasks are currently running on a port. */
export interface RunningStatus {
  tx: boolean
  rx: boolean
  pcap: boolean
}

/** One entry of `GET /ports`. */
export interface PortStatus {
  pci: string
  /** NIC link state: `true` when up, `false` when down, `null` if unreadable. */
  link_up: boolean | null
  mode: PortMode
  running: RunningStatus
  /** A finished capture is available for download. */
  pcap_ready: boolean
}

/**
 * NIC hardware counters (`rte_eth_stats`), accumulated since the port started.
 * The NIC counts everything it receives, so `rx_missed`/`rx_errors` can grow
 * even while the Rx worker is stopped.
 */
export interface HwStats {
  rx_packets: number
  tx_packets: number
  rx_bytes: number
  tx_bytes: number
  rx_missed: number
  rx_errors: number
  tx_errors: number
  rx_nombuf: number
}

/**
 * Software counters tallied by the worker, accumulated since the port was added
 * and preserved across tx/rx start/stop. Counts only frames the worker handled.
 */
export interface SwStats {
  tx_frames: number
  tx_bytes: number
  rx_frames: number
  rx_bytes: number
}

/** Body of `GET /ports/<pci>/stats`. */
export interface PortStats {
  pci: string
  hw: HwStats
  sw: SwStats
}

/**
 * Body of `POST /ports`. `rxq`/`txq` default to 1, `rxd` (descriptors per rx
 * queue) to 1024, `mode` to all-enabled.
 */
export interface AddPortRequest {
  pci: string
  rxq?: number
  txq?: number
  /** Number of descriptors in each rx queue's ring (default 1024). */
  rxd?: number
  mode?: PortMode
}

export type Protocol = 'ipv4' | 'ipv6' | 'arp'
export type ArpOp = 'request' | 'reply'

/** Fields shared by every transmit stream, regardless of protocol. */
interface StreamBase {
  src_mac: string
  dst_mac: string
  src_ip: string
  dst_ip: string
  /** VLAN VID (< 4096). Omit for untagged. */
  vlan?: number
  /** Frames to send (default 1, min 1). */
  count?: number
  /** Payload bytes (default 64, max 1500). */
  payload_len?: number
  /**
   * Transmit rate in frames per second. Mutually exclusive with `rate_mbps`;
   * omit both to send at full speed.
   */
  rate_pps?: number
  /**
   * Transmit rate in Mbps of the L2 frame (FCS/preamble/IFG excluded, decimals
   * allowed). Mutually exclusive with `rate_pps`; omit both for full speed.
   */
  rate_mbps?: number
}

export interface Ipv4Stream extends StreamBase {
  protocol: 'ipv4'
  /** Default 64. */
  ttl?: number
  /** IP protocol number of the (absent) L4 header. Default 253. */
  l4_protocol?: number
}

export interface Ipv6Stream extends StreamBase {
  protocol: 'ipv6'
  /** Default 64. */
  hop_limit?: number
  /** Next-header value. Default 253. */
  l4_protocol?: number
}

export interface ArpStream extends StreamBase {
  protocol: 'arp'
  /** Default "request". */
  arp_op?: ArpOp
}

/** A single `[[tx.streams]]` entry, discriminated by `protocol`. */
export type Stream = Ipv4Stream | Ipv6Stream | ArpStream

/** Body of `POST /ports/<pci>/tx/start`. */
export interface TxStartRequest {
  streams: Stream[]
}
