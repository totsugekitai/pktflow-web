/**
 * Types mirroring the pktflow-web backend API. Host management is served by the
 * Go backend itself; everything else is the subset of the Open Traffic
 * Generator (OTG) REST API the pktflow daemon implements, forwarded verbatim
 * (see `pktflow/src/daemon/otg/model.rs` and `pktflow/TODO.md`).
 *
 * The daemon serializes absent optional fields as `null`, so every optional
 * field read back from it is typed `T | null` as well as optional.
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

// ---------------------------------------------------------------------------
// Config (POST/GET /config)
// ---------------------------------------------------------------------------

/**
 * A test port. `location` is pktflow-specific: `"<pci>"` or
 * `"<pci>?rxq=N&txq=N&rxd=N"` (see `otg/location.ts`).
 */
export interface Port {
  name: string
  location: string
}

/** A capture target. pktflow only supports the `pcapng` format. */
export interface Capture {
  name: string
  port_names: string[]
  format?: 'pcapng'
  /** Accepted but ignored by pktflow. */
  filters?: unknown[]
}

export interface PatternCounter<S> {
  start: S
  step: S
  /** Length of the cycle (default 1). */
  count?: number | null
}

export interface PatternRandom<S> {
  min: S
  max: S
  /** 0 (the default) asks for a non-deterministic sequence. */
  seed?: number | null
  /** Length of the cycle (default 1). */
  count?: number | null
}

export type PatternChoice = 'value' | 'values' | 'increment' | 'decrement' | 'random'

/**
 * An OTG `Pattern.*` object for one header field. `S` is the wire scalar:
 * a string for MAC/IPv4/IPv6 fields, a number for integer fields.
 */
export interface Pattern<S> {
  choice?: PatternChoice
  value?: S | null
  values?: S[] | null
  increment?: PatternCounter<S> | null
  decrement?: PatternCounter<S> | null
  random?: PatternRandom<S> | null
}

export interface EthernetHeader {
  dst?: Pattern<string> | null
  src?: Pattern<string> | null
}

export interface VlanHeader {
  id?: Pattern<number> | null
}

export interface Ipv4Header {
  src?: Pattern<string> | null
  dst?: Pattern<string> | null
  time_to_live?: Pattern<number> | null
  protocol?: Pattern<number> | null
}

export interface Ipv6Header {
  src?: Pattern<string> | null
  dst?: Pattern<string> | null
  hop_limit?: Pattern<number> | null
  next_header?: Pattern<number> | null
}

export interface ArpHeader {
  operation?: Pattern<number> | null
  sender_protocol_addr?: Pattern<string> | null
  target_protocol_addr?: Pattern<string> | null
}

export type HeaderChoice = 'ethernet' | 'vlan' | 'ipv4' | 'ipv6' | 'arp'

/** One `Flow.packet[]` entry: a `choice` tag plus the matching header. */
export interface Header {
  choice: HeaderChoice
  ethernet?: EthernetHeader | null
  vlan?: VlanHeader | null
  ipv4?: Ipv4Header | null
  ipv6?: Ipv6Header | null
  arp?: ArpHeader | null
}

export interface FlowPort {
  tx_name: string
  rx_names: string[]
}

export interface TxRx {
  choice: 'port'
  port: FlowPort | null
}

/** Frame size. pktflow only supports `fixed` (bytes, FCS included; default 64). */
export interface Size {
  choice: 'fixed'
  fixed?: number | null
}

export type RateChoice = 'pps' | 'bps' | 'kbps' | 'mbps' | 'gbps'

/** Transmit rate. When the whole `Flow.rate` is absent, pktflow sends at full speed. */
export interface Rate {
  choice: RateChoice
  pps?: number | null
  bps?: number | null
  kbps?: number | null
  mbps?: number | null
  gbps?: number | null
}

export type DurationChoice = 'continuous' | 'fixed_packets'

export interface Duration {
  choice: DurationChoice
  fixed_packets?: { packets: number } | null
}

export interface Flow {
  name: string
  tx_rx: TxRx
  packet: Header[]
  size?: Size | null
  rate?: Rate | null
  duration?: Duration | null
}

/** The whole daemon configuration; `POST /config` replaces it atomically. */
export interface Config {
  ports: Port[]
  captures: Capture[]
  flows: Flow[]
}

/** Success body of state-changing OTG calls. */
export interface WarningResponse {
  warnings: string[]
}

// ---------------------------------------------------------------------------
// Control (POST /control/state)
// ---------------------------------------------------------------------------

export type LinkState = 'up' | 'down'
export type CaptureState = 'start' | 'stop'
export type TransmitState = 'start' | 'stop'

export type ControlState =
  | {
      choice: 'port'
      port:
        | { choice: 'link'; link: { port_names: string[]; state: LinkState } }
        | { choice: 'capture'; capture: { port_names: string[]; state: CaptureState } }
    }
  | {
      choice: 'traffic'
      traffic: {
        choice: 'flow_transmit'
        flow_transmit: { flow_names: string[]; state: TransmitState }
      }
    }

// ---------------------------------------------------------------------------
// Monitor (POST /monitor/metrics, POST /monitor/capture)
// ---------------------------------------------------------------------------

/** An empty name list selects every port / flow. */
export type MetricsRequest =
  | { choice: 'port'; port: { port_names: string[] } }
  | { choice: 'flow'; flow: { flow_names: string[] } }

export type RunState = 'started' | 'stopped'

/** Software counters of one port; rates are per second since the previous poll. */
export interface PortMetric {
  name: string
  location: string
  link: 'up' | 'down'
  capture: RunState
  transmit: RunState
  frames_tx: number
  frames_rx: number
  bytes_tx: number
  bytes_rx: number
  frames_tx_rate: number
  frames_rx_rate: number
  bytes_tx_rate: number
  bytes_rx_rate: number
}

/** Per-flow counters. Rx-side fields are always 0 in pktflow (not implemented). */
export interface FlowMetric {
  name: string
  port_tx: string
  port_rx: string
  transmit: RunState
  frames_tx: number
  frames_rx: number
  bytes_tx: number
  bytes_rx: number
  frames_tx_rate: number
  frames_rx_rate: number
  loss: number
}

export interface MetricsResponse {
  choice: 'port_metrics' | 'flow_metrics'
  port_metrics?: PortMetric[]
  flow_metrics?: FlowMetric[]
}

/** Body of `POST /monitor/capture`; the response is the pcapng bytes. */
export interface CaptureRequest {
  port_name: string
}
