/**
 * Live end-to-end check against a real pktflow daemon, driven through the
 * pktflow-web backend with the frontend's own API, config, and flow-draft code
 * (so it sends exactly the requests the UI actions send).
 *
 * Requirements:
 * - a running pktflow daemon whose config is empty (the script refuses to run
 *   otherwise, since it replaces and finally clears the whole config);
 * - the backend listening on PKTFLOW_WEB_URL and pointing at that daemon;
 * - two DPDK-usable ports cabled back to back (Tx → Rx loopback).
 *
 * Usage (Node >= 23.6 for native TypeScript):
 *   E2E_TX_PCI=0000:01:00.0 E2E_RX_PCI=0000:01:00.1 pnpm e2e:live
 *
 * Environment:
 *   E2E_TX_PCI, E2E_RX_PCI  PCI addresses of the Tx and Rx ports (required)
 *   PKTFLOW_WEB_URL         backend origin (default http://127.0.0.1:8080)
 *   E2E_HOST_ID             backend host id (default "local")
 *   E2E_PCAP_OUT            if set, the Rx capture is also written to this path
 */

import { writeFile } from 'node:fs/promises'
import {
  getCapture,
  getConfig,
  getFlowMetrics,
  getPortMetrics,
  setControlState,
  updateConfig,
} from '../src/api/otg.ts'
import type { ControlState, FlowMetric, PortMetric } from '../src/api/types.ts'
import { addPort, ensureCapture, removeFlow, removePort, saveFlow } from '../src/otg/configOps.ts'
import { formatLocation } from '../src/otg/location.ts'
import { draftToFlow, emptyFlowDraft, flowToDraft } from '../src/features/flows/flowDraft.ts'

function requireEnv(name: string): string {
  const value = process.env[name]
  if (value === undefined || value === '') {
    throw new Error(`${name} is required (see the header of e2e/live.ts)`)
  }
  return value
}

const BACKEND = process.env.PKTFLOW_WEB_URL ?? 'http://127.0.0.1:8080'
const H = process.env.E2E_HOST_ID ?? 'local'
const TX_PCI = requireEnv('E2E_TX_PCI')
const RX_PCI = requireEnv('E2E_RX_PCI')
const PCAP_OUT = process.env.E2E_PCAP_OUT

// The frontend fetches relative `/api/...` paths; resolve them against the backend.
const realFetch = globalThis.fetch
globalThis.fetch = (input: RequestInfo | URL, init?: RequestInit) =>
  realFetch(typeof input === 'string' && input.startsWith('/') ? BACKEND + input : input, init)

let failures = 0

function check(label: string, ok: boolean, detail?: unknown): void {
  if (!ok) failures++
  const suffix = detail === undefined ? '' : `  ${JSON.stringify(detail)}`
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${suffix}`)
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

async function portMetric(name: string): Promise<PortMetric | undefined> {
  return (await getPortMetrics(H)).find((m) => m.name === name)
}

async function flowMetric(name: string): Promise<FlowMetric | undefined> {
  return (await getFlowMetrics(H)).find((m) => m.name === name)
}

/** Polls `fn` until `pred` holds or the timeout expires; returns the last value. */
async function waitFor<T>(
  fn: () => Promise<T>,
  pred: (v: T) => boolean,
  timeoutMs = 10000,
): Promise<T> {
  const deadline = Date.now() + timeoutMs
  let value = await fn()
  while (!pred(value) && Date.now() < deadline) {
    await sleep(250)
    value = await fn()
  }
  return value
}

async function expectReject(label: string, promise: Promise<unknown>, pattern: RegExp) {
  try {
    await promise
    check(label, false, 'resolved')
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    check(label, pattern.test(message), message)
  }
}

function portState(port: ControlState & { choice: 'port' }): Promise<string[]> {
  return setControlState(H, port)
}

function transmit(names: string[], state: 'start' | 'stop'): Promise<string[]> {
  return setControlState(H, {
    choice: 'traffic',
    traffic: { choice: 'flow_transmit', flow_transmit: { flow_names: names, state } },
  })
}

async function run(): Promise<void> {
  // --- Ports: AddPortForm, PortCard link/capture -------------------------
  for (const [name, pci] of [['p1', TX_PCI], ['p2', RX_PCI]] as const) {
    await updateConfig(H, (c) =>
      addPort(c, { name, location: formatLocation({ pci, rxq: 1, txq: 1, rxd: 1024 }) }),
    )
  }
  let config = await getConfig(H)
  check('ports added', config.ports.map((p) => p.name).sort().join() === 'p1,p2', config.ports)

  await expectReject(
    'duplicate PCI rejected client-side',
    updateConfig(H, (c) => addPort(c, { name: 'p3', location: TX_PCI })),
    /already configured as port "p1"/,
  )

  const m1 = await waitFor(() => portMetric('p1'), (m) => m?.link === 'up')
  const m2 = await waitFor(() => portMetric('p2'), (m) => m?.link === 'up')
  check('p1/p2 link up', m1?.link === 'up' && m2?.link === 'up', [m1?.link, m2?.link])

  await portState({ choice: 'port', port: { choice: 'link', link: { port_names: ['p2'], state: 'down' } } })
  const down = await waitFor(() => portMetric('p2'), (m) => m?.link === 'down')
  check('p2 link down', down?.link === 'down', down?.link)
  await portState({ choice: 'port', port: { choice: 'link', link: { port_names: ['p2'], state: 'up' } } })
  const up = await waitFor(() => portMetric('p2'), (m) => m?.link === 'up', 15000)
  check('p2 link up again', up?.link === 'up', up?.link)

  await updateConfig(H, (c) => ensureCapture(c, 'p2'))
  await portState({ choice: 'port', port: { choice: 'capture', capture: { port_names: ['p2'], state: 'start' } } })
  config = await getConfig(H)
  check('capture entry added', config.captures.some((c) => c.port_names.includes('p2')), config.captures)
  check('capture started', (await portMetric('p2'))?.capture === 'started')

  // --- Flows: FlowEditor → draftToFlow → saveFlow -------------------------
  const draft = emptyFlowDraft('p1')
  draft.name = 'f1'
  draft.rx_names = ['p2']
  draft.fields['ethernet.src'].value = '00:11:22:33:44:55'
  draft.fields['ethernet.dst'].value = '66:77:88:99:aa:bb'
  Object.assign(draft.fields['ipv4.src'], { choice: 'increment', start: '10.0.0.1', step: '0.0.0.1', count: '10' })
  draft.fields['ipv4.dst'].value = '10.0.0.2'
  draft.vlan = true
  draft.fields['vlan.id'].value = '100'
  draft.size = '128'
  draft.rate_choice = 'pps'
  draft.rate_value = '10000'
  draft.duration = 'fixed_packets'
  draft.packets = '1000'
  const built = draftToFlow(draft)
  if (!built.ok) throw new Error(`draft invalid: ${built.errors.join('; ')}`)
  await updateConfig(H, (c) => saveFlow(c, built.value))

  config = await getConfig(H)
  const stored = config.flows.find((f) => f.name === 'f1')
  if (stored === undefined) throw new Error('flow f1 was not stored')
  // What the editor loads from GET /config must rebuild the same flow.
  const rebuilt = draftToFlow(flowToDraft(stored))
  check(
    'flowToDraft round-trip',
    rebuilt.ok && JSON.stringify(rebuilt.value) === JSON.stringify(built.value),
    rebuilt.ok ? undefined : rebuilt.errors,
  )

  await expectReject(
    'removing a port used by a flow is refused',
    updateConfig(H, (c) => removePort(c, 'p1')),
    /used by flow\(s\) "f1"/,
  )

  const rxBefore = (await portMetric('p2'))?.frames_rx ?? 0
  await transmit(['f1'], 'start')
  const sent = await waitFor(() => flowMetric('f1'), (m) => m?.frames_tx === 1000)
  check('f1 sent 1000 frames', sent?.frames_tx === 1000, sent)
  check('f1 bytes_tx = 1000 × 124 (128 − FCS)', sent?.bytes_tx === 124000, sent?.bytes_tx)
  const received = await waitFor(() => portMetric('p2'), (m) => (m?.frames_rx ?? 0) - rxBefore >= 1000)
  check('p2 received ≥ 1000 frames', (received?.frames_rx ?? 0) - rxBefore >= 1000, {
    rxBefore,
    now: received?.frames_rx,
  })
  check('p1 frames_tx ≥ 1000', ((await portMetric('p1'))?.frames_tx ?? 0) >= 1000)
  const finished = await waitFor(() => flowMetric('f1'), (m) => m?.transmit === 'stopped')
  check('fixed_packets flow ends as stopped', finished?.transmit === 'stopped', finished?.transmit)

  // --- PortCard: Download pcap (also stops the capture) -------------------
  const capture = new Uint8Array(await (await getCapture(H, 'p2')).arrayBuffer())
  const magic = Array.from(capture.slice(0, 4), (b) => b.toString(16).padStart(2, '0')).join('')
  check('capture is pcapng', magic === '0a0d0d0a', { magic, size: capture.length })
  if (PCAP_OUT !== undefined) await writeFile(PCAP_OUT, capture)
  check('capture stopped by download', (await portMetric('p2'))?.capture === 'stopped')

  // --- Continuous flow, rate, Stop all ------------------------------------
  const continuous = flowToDraft(stored)
  continuous.name = 'f2'
  continuous.duration = 'continuous'
  continuous.rate_value = '1000'
  const f2 = draftToFlow(continuous)
  if (!f2.ok) throw new Error(`draft invalid: ${f2.errors.join('; ')}`)
  await updateConfig(H, (c) => saveFlow(c, f2.value))
  await transmit(['f2'], 'start')
  const running = await waitFor(() => flowMetric('f2'), (m) => m?.transmit === 'started' && m.frames_tx > 0)
  check('continuous f2 running', running?.transmit === 'started', running)
  // Rates are deltas between polls, so poll once more after a known interval.
  await sleep(2000)
  const rated = await flowMetric('f2')
  check('f2 frames_tx_rate ≈ 1000 pps', Math.abs((rated?.frames_tx_rate ?? 0) - 1000) < 150, rated?.frames_tx_rate)
  check('p1 transmit = started', (await portMetric('p1'))?.transmit === 'started')
  await transmit([], 'stop')
  const stopped = await waitFor(() => flowMetric('f2'), (m) => m?.transmit === 'stopped')
  check('Stop all stops f2', stopped?.transmit === 'stopped', stopped?.transmit)

  await expectReject(
    'daemon error message surfaces',
    portState({ choice: 'port', port: { choice: 'capture', capture: { port_names: ['nope'], state: 'start' } } }),
    /nope/,
  )

  await updateConfig(H, (c) => saveFlow(c, { ...f2.value, name: 'f2-renamed' }, 'f2'))
  config = await getConfig(H)
  check('flow renamed', config.flows.map((f) => f.name).sort().join() === 'f1,f2-renamed', config.flows.map((f) => f.name))
}

/** FlowCard Delete ×N, then PortCard Delete ×N, leaving the daemon empty again. */
async function cleanup(): Promise<void> {
  await transmit([], 'stop')
  const config = await getConfig(H)
  for (const f of config.flows) await updateConfig(H, (c) => removeFlow(c, f.name))
  for (const p of config.ports) await updateConfig(H, (c) => removePort(c, p.name))
  const end = await getConfig(H)
  check(
    'cleanup: config empty',
    end.ports.length === 0 && end.flows.length === 0 && end.captures.length === 0,
    end,
  )
}

const initial = await getConfig(H)
if (initial.ports.length > 0 || initial.flows.length > 0 || initial.captures.length > 0) {
  console.error('Refusing to run: the daemon config is not empty (this test replaces and clears it).')
  process.exit(2)
}

try {
  await run()
} catch (e) {
  failures++
  console.log('FAIL  unexpected error', e instanceof Error ? e.message : e)
} finally {
  try {
    await cleanup()
  } catch (e) {
    failures++
    console.log('FAIL  cleanup', e instanceof Error ? e.message : e)
  }
}

console.log(failures === 0 ? '\nALL PASSED' : `\n${failures} FAILURE(S)`)
process.exitCode = failures === 0 ? 0 : 1
