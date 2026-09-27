import { setupServer } from 'msw/node'
import { http, HttpResponse } from 'msw'
import type { Config, Flow, FlowMetric, Host, Port, PortMetric } from '../api/types.ts'

/** The built-in local host, as the backend reports it. */
export function makeHost(overrides: Partial<Host> = {}): Host {
  return { id: 'local', label: 'Local', address: 'http://127.0.0.1:7878', ...overrides }
}

/** A configured port in the daemon's canonical location form. */
export function makePort(overrides: Partial<Port> = {}): Port {
  return { name: 'p1', location: '0000:02:00.0?rxq=1&txq=1&rxd=1024', ...overrides }
}

/** An ethernet/ipv4 flow from p1 to p2 with every other field defaulted. */
export function makeFlow(overrides: Partial<Flow> = {}): Flow {
  return {
    name: 'f1',
    tx_rx: { choice: 'port', port: { tx_name: 'p1', rx_names: ['p2'] } },
    packet: [
      {
        choice: 'ethernet',
        ethernet: {
          src: { choice: 'value', value: '00:11:22:33:44:55' },
          dst: { choice: 'value', value: '66:77:88:99:aa:bb' },
        },
      },
      {
        choice: 'ipv4',
        ipv4: {
          src: { choice: 'value', value: '10.0.0.1' },
          dst: { choice: 'value', value: '10.0.0.2' },
        },
      },
    ],
    duration: { choice: 'continuous' },
    ...overrides,
  }
}

export function makeConfig(overrides: Partial<Config> = {}): Config {
  return { ports: [], captures: [], flows: [], ...overrides }
}

/** Metrics of an idle port with the link up and all counters zeroed. */
export function makePortMetric(overrides: Partial<PortMetric> = {}): PortMetric {
  return {
    name: 'p1',
    location: '0000:02:00.0?rxq=1&txq=1&rxd=1024',
    link: 'up',
    capture: 'stopped',
    transmit: 'stopped',
    frames_tx: 0,
    frames_rx: 0,
    bytes_tx: 0,
    bytes_rx: 0,
    frames_tx_rate: 0,
    frames_rx_rate: 0,
    bytes_tx_rate: 0,
    bytes_rx_rate: 0,
    ...overrides,
  }
}

/** Metrics of an idle flow with all counters zeroed. */
export function makeFlowMetric(overrides: Partial<FlowMetric> = {}): FlowMetric {
  return {
    name: 'f1',
    port_tx: 'p1',
    port_rx: 'p2',
    transmit: 'stopped',
    frames_tx: 0,
    frames_rx: 0,
    bytes_tx: 0,
    bytes_rx: 0,
    frames_tx_rate: 0,
    frames_rx_rate: 0,
    loss: 0,
    ...overrides,
  }
}

/**
 * Serves `config` from `GET /config` and the given metrics from
 * `POST /monitor/metrics`, answering by the request's `choice`.
 */
export function daemonHandlers(
  config: Config,
  metrics: { ports?: PortMetric[]; flows?: FlowMetric[] } = {},
) {
  return [
    http.get('/api/hosts/:id/config', () => HttpResponse.json(config)),
    http.post('/api/hosts/:id/monitor/metrics', async ({ request }) => {
      const { choice } = (await request.json()) as { choice: 'port' | 'flow' }
      return HttpResponse.json(
        choice === 'port'
          ? { choice: 'port_metrics', port_metrics: metrics.ports ?? [] }
          : { choice: 'flow_metrics', flow_metrics: metrics.flows ?? [] },
      )
    }),
  ]
}

/**
 * Default handlers: a single local host and an empty daemon. Tests override
 * per-case with `server.use`.
 */
export const defaultHandlers = [
  http.get('/api/hosts', () => HttpResponse.json({ hosts: [makeHost()] })),
  ...daemonHandlers(makeConfig()),
]

export const server = setupServer(...defaultHandlers)
