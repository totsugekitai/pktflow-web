import { describe, expect, it } from 'vitest'
import type { Flow } from '../../api/types.ts'
import { makeFlow } from '../../test/server.ts'
import {
  buildPattern,
  draftToFlow,
  emptyFlowDraft,
  emptyPattern,
  FIELD_SPECS,
  type FlowDraft,
  flowToDraft,
  summarizePattern,
} from './flowDraft.ts'

/** A minimal valid draft: p1 → p2, ethernet/ipv4 with explicit addresses. */
function validDraft(overrides: Partial<FlowDraft> = {}): FlowDraft {
  const draft = emptyFlowDraft('p1')
  draft.name = 'f1'
  draft.rx_names = ['p2']
  draft.fields['ethernet.src'].value = '00:11:22:33:44:55'
  draft.fields['ethernet.dst'].value = '66:77:88:99:aa:bb'
  draft.fields['ipv4.src'].value = '10.0.0.1'
  draft.fields['ipv4.dst'].value = '10.0.0.2'
  return { ...draft, ...overrides }
}

describe('buildPattern', () => {
  it('omits a blank single value so the daemon default applies', () => {
    expect(buildPattern(emptyPattern(), FIELD_SPECS['ipv4.time_to_live'])).toEqual({
      ok: true,
      value: undefined,
    })
  })

  it('parses integer fields into numbers', () => {
    const draft = { ...emptyPattern(), choice: 'values' as const, values: '1, 2,3' }
    expect(buildPattern(draft, FIELD_SPECS['vlan.id'])).toEqual({
      ok: true,
      value: { choice: 'values', values: [1, 2, 3] },
    })
  })

  it('builds an increment counter, omitting a blank count', () => {
    const draft = { ...emptyPattern(), choice: 'increment' as const, start: '10.0.0.1', step: '0.0.0.1' }
    expect(buildPattern(draft, FIELD_SPECS['ipv4.src'])).toEqual({
      ok: true,
      value: { choice: 'increment', increment: { start: '10.0.0.1', step: '0.0.0.1', count: undefined } },
    })
  })

  it('builds a seeded random pattern', () => {
    const draft = { ...emptyPattern(), choice: 'random' as const, min: '1', max: '100', seed: '42', count: '8' }
    expect(buildPattern(draft, FIELD_SPECS['ipv4.time_to_live'])).toEqual({
      ok: true,
      value: { choice: 'random', random: { min: 1, max: 100, seed: 42, count: 8 } },
    })
  })

  it('reports invalid and out-of-range values', () => {
    const vlan = buildPattern({ ...emptyPattern(), value: '4096' }, FIELD_SPECS['vlan.id'])
    expect(vlan.ok).toBe(false)
    const mac = buildPattern({ ...emptyPattern(), value: '00:11:22' }, FIELD_SPECS['ethernet.src'])
    expect(mac).toEqual({ ok: false, errors: ['Src MAC: value "00:11:22" is not a MAC address'] })
    const counter = buildPattern(
      { ...emptyPattern(), choice: 'decrement', start: '5' },
      FIELD_SPECS['ipv4.time_to_live'],
    )
    expect(counter).toEqual({ ok: false, errors: ['TTL: step is required'] })
  })
})

describe('draftToFlow', () => {
  it('builds the OTG flow, omitting defaulted fields', () => {
    expect(draftToFlow(validDraft())).toEqual({ ok: true, value: makeFlow() })
  })

  it('includes vlan, size, rate, and fixed packet count when set', () => {
    const draft = validDraft({
      vlan: true,
      size: '128',
      rate_choice: 'mbps',
      rate_value: '100',
      duration: 'fixed_packets',
      packets: '1000',
    })
    draft.fields['vlan.id'].value = '100'
    const res = draftToFlow(draft)
    if (!res.ok) throw new Error(res.errors.join())
    expect(res.value.packet.map((h) => h.choice)).toEqual(['ethernet', 'vlan', 'ipv4'])
    expect(res.value.packet[1]).toEqual({ choice: 'vlan', vlan: { id: { choice: 'value', value: 100 } } })
    expect(res.value.size).toEqual({ choice: 'fixed', fixed: 128 })
    expect(res.value.rate).toEqual({ choice: 'mbps', mbps: 100 })
    expect(res.value.duration).toEqual({ choice: 'fixed_packets', fixed_packets: { packets: 1000 } })
  })

  it('collects every validation error', () => {
    const res = draftToFlow(validDraft({ name: ' ', rate_choice: 'pps', rate_value: '' }))
    expect(res).toEqual({
      ok: false,
      errors: ['Name is required', 'Rate must be an integer between 1 and 9007199254740991'],
    })
  })
})

describe('flowToDraft', () => {
  it('round-trips a flow read back from the daemon (with nulls)', () => {
    const fromDaemon: Flow = {
      name: 'f1',
      tx_rx: { choice: 'port', port: { tx_name: 'p1', rx_names: ['p2'] } },
      packet: [
        {
          choice: 'ethernet',
          ethernet: {
            src: { choice: 'value', value: '00:11:22:33:44:55', values: null, increment: null },
            dst: { choice: 'value', value: '66:77:88:99:aa:bb' },
          },
          vlan: null,
          ipv4: null,
        },
        {
          choice: 'ipv4',
          ipv4: {
            src: {
              choice: 'increment',
              value: null,
              increment: { start: '10.0.0.1', step: '0.0.0.1', count: 10 },
            },
            dst: { choice: 'value', value: '10.0.0.2' },
            time_to_live: null,
            protocol: null,
          },
        },
      ],
      size: null,
      rate: { choice: 'pps', pps: 5000, bps: null },
      duration: { choice: 'continuous', fixed_packets: null },
    }
    const draft = flowToDraft(fromDaemon)
    expect(draft.fields['ipv4.src']).toMatchObject({
      choice: 'increment',
      start: '10.0.0.1',
      step: '0.0.0.1',
      count: '10',
    })
    expect(draft).toMatchObject({ rate_choice: 'pps', rate_value: '5000', l3: 'ipv4', vlan: false })

    const res = draftToFlow(draft)
    if (!res.ok) throw new Error(res.errors.join())
    expect(res.value.packet[1]).toEqual({
      choice: 'ipv4',
      ipv4: {
        src: { choice: 'increment', increment: { start: '10.0.0.1', step: '0.0.0.1', count: 10 } },
        dst: { choice: 'value', value: '10.0.0.2' },
      },
    })
    expect(res.value.rate).toEqual({ choice: 'pps', pps: 5000 })
  })
})

describe('summarizePattern', () => {
  it('renders each choice compactly', () => {
    expect(summarizePattern({ choice: 'value', value: '10.0.0.1' })).toBe('10.0.0.1')
    expect(summarizePattern({ choice: 'values', values: [1, 2] })).toBe('[1, 2]')
    expect(
      summarizePattern({ choice: 'increment', increment: { start: '10.0.0.1', step: '0.0.0.1', count: 4 } }),
    ).toBe('10.0.0.1 +0.0.0.1 ×4')
    expect(summarizePattern({ choice: 'random', random: { min: 1, max: 9 } })).toBe('random 1–9')
    expect(summarizePattern(null)).toBeUndefined()
  })
})
