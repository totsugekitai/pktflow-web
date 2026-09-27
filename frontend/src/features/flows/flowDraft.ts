/**
 * String-backed editing state for an OTG flow and pure conversions between it
 * and the wire {@link Flow}. Blank optional inputs are omitted from the flow so
 * the daemon applies its own defaults.
 */

import type {
  DurationChoice,
  Flow,
  Header,
  HeaderChoice,
  Pattern,
  PatternChoice,
  RateChoice,
} from '../../api/types.ts'

export type Result<T> = { ok: true; value: T } | { ok: false; errors: string[] }

// ---------------------------------------------------------------------------
// Header field catalogue
// ---------------------------------------------------------------------------

/** Wire type of a header field: string addresses or bounded integers. */
export type FieldKind = 'mac' | 'ipv4' | 'ipv6' | 'uint'

export interface FieldSpec {
  header: HeaderChoice
  /** Property name inside the header object. */
  field: string
  label: string
  kind: FieldKind
  /** Upper bound for `uint` fields. */
  max?: number
  /** Daemon default, shown when the value is left blank. */
  placeholder: string
  /** Example step for increment/decrement. */
  stepPlaceholder: string
}

const U8 = 255
const U16 = 65535
const U32 = 4294967295
const VLAN_ID_MAX = 4095

export const FIELD_SPECS = {
  'ethernet.src': {
    header: 'ethernet',
    field: 'src',
    label: 'Src MAC',
    kind: 'mac',
    placeholder: '00:00:00:00:00:00',
    stepPlaceholder: '00:00:00:00:00:01',
  },
  'ethernet.dst': {
    header: 'ethernet',
    field: 'dst',
    label: 'Dst MAC',
    kind: 'mac',
    placeholder: '00:00:00:00:00:00',
    stepPlaceholder: '00:00:00:00:00:01',
  },
  'vlan.id': {
    header: 'vlan',
    field: 'id',
    label: 'VLAN ID',
    kind: 'uint',
    max: VLAN_ID_MAX,
    placeholder: '0',
    stepPlaceholder: '1',
  },
  'ipv4.src': {
    header: 'ipv4',
    field: 'src',
    label: 'Src IP',
    kind: 'ipv4',
    placeholder: '0.0.0.0',
    stepPlaceholder: '0.0.0.1',
  },
  'ipv4.dst': {
    header: 'ipv4',
    field: 'dst',
    label: 'Dst IP',
    kind: 'ipv4',
    placeholder: '0.0.0.0',
    stepPlaceholder: '0.0.0.1',
  },
  'ipv4.time_to_live': {
    header: 'ipv4',
    field: 'time_to_live',
    label: 'TTL',
    kind: 'uint',
    max: U8,
    placeholder: '64',
    stepPlaceholder: '1',
  },
  'ipv4.protocol': {
    header: 'ipv4',
    field: 'protocol',
    label: 'Protocol',
    kind: 'uint',
    max: U8,
    placeholder: '253',
    stepPlaceholder: '1',
  },
  'ipv6.src': {
    header: 'ipv6',
    field: 'src',
    label: 'Src IP',
    kind: 'ipv6',
    placeholder: '::',
    stepPlaceholder: '::1',
  },
  'ipv6.dst': {
    header: 'ipv6',
    field: 'dst',
    label: 'Dst IP',
    kind: 'ipv6',
    placeholder: '::',
    stepPlaceholder: '::1',
  },
  'ipv6.hop_limit': {
    header: 'ipv6',
    field: 'hop_limit',
    label: 'Hop limit',
    kind: 'uint',
    max: U8,
    placeholder: '64',
    stepPlaceholder: '1',
  },
  'ipv6.next_header': {
    header: 'ipv6',
    field: 'next_header',
    label: 'Next header',
    kind: 'uint',
    max: U8,
    placeholder: '253',
    stepPlaceholder: '1',
  },
  'arp.operation': {
    header: 'arp',
    field: 'operation',
    label: 'Operation (1=request, 2=reply)',
    kind: 'uint',
    max: U16,
    placeholder: '1',
    stepPlaceholder: '1',
  },
  'arp.sender_protocol_addr': {
    header: 'arp',
    field: 'sender_protocol_addr',
    label: 'Sender IP',
    kind: 'ipv4',
    placeholder: '0.0.0.0',
    stepPlaceholder: '0.0.0.1',
  },
  'arp.target_protocol_addr': {
    header: 'arp',
    field: 'target_protocol_addr',
    label: 'Target IP',
    kind: 'ipv4',
    placeholder: '0.0.0.0',
    stepPlaceholder: '0.0.0.1',
  },
} as const satisfies Record<string, FieldSpec>

export type FieldKey = keyof typeof FIELD_SPECS

/** Field keys of each header, in display order. */
export const HEADER_FIELDS: Record<HeaderChoice, FieldKey[]> = {
  ethernet: ['ethernet.src', 'ethernet.dst'],
  vlan: ['vlan.id'],
  ipv4: ['ipv4.src', 'ipv4.dst', 'ipv4.time_to_live', 'ipv4.protocol'],
  ipv6: ['ipv6.src', 'ipv6.dst', 'ipv6.hop_limit', 'ipv6.next_header'],
  arp: ['arp.operation', 'arp.sender_protocol_addr', 'arp.target_protocol_addr'],
}

/** Pattern choices a field supports; OTG defines no `random` for MAC fields. */
export function patternChoices(kind: FieldKind): PatternChoice[] {
  const all: PatternChoice[] = ['value', 'values', 'increment', 'decrement', 'random']
  return kind === 'mac' ? all.filter((c) => c !== 'random') : all
}

// ---------------------------------------------------------------------------
// Pattern drafts
// ---------------------------------------------------------------------------

/** Editing state of one pattern; only the inputs of `choice` are used. */
export interface PatternDraft {
  choice: PatternChoice
  value: string
  /** Comma-separated list for `values`. */
  values: string
  start: string
  step: string
  count: string
  min: string
  max: string
  seed: string
}

export function emptyPattern(): PatternDraft {
  return {
    choice: 'value',
    value: '',
    values: '',
    start: '',
    step: '',
    count: '',
    min: '',
    max: '',
    seed: '',
  }
}

type Scalar = string | number

const MAC_RE = /^[0-9a-fA-F]{2}(:[0-9a-fA-F]{2}){5}$/
const IPV4_RE = /^(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$/

/** Parses an integer in `[min, max]`, or returns an error message. */
function parseUint(raw: string, min: number, max: number): number | string {
  const n = Number(raw)
  if (raw === '' || !Number.isInteger(n) || n < min || n > max) {
    return `must be an integer between ${min} and ${max}`
  }
  return n
}

/** Parses one scalar of the field's wire type, or returns an error message. */
function parseScalar(raw: string, spec: FieldSpec): Scalar | { error: string } {
  const s = raw.trim()
  switch (spec.kind) {
    case 'mac':
      return MAC_RE.test(s) ? s : { error: `"${s}" is not a MAC address` }
    case 'ipv4':
      return IPV4_RE.test(s) ? s : { error: `"${s}" is not an IPv4 address` }
    case 'ipv6':
      return s.includes(':') ? s : { error: `"${s}" is not an IPv6 address` }
    case 'uint': {
      const n = parseUint(s, 0, spec.max ?? U32)
      return typeof n === 'number' ? n : { error: n }
    }
  }
}

function isError(v: Scalar | { error: string }): v is { error: string } {
  return typeof v === 'object'
}

/** Parses an optional u32 (`count`, `seed`); blank means "daemon default". */
function parseOptional(raw: string, min: number): number | undefined | { error: string } {
  const s = raw.trim()
  if (s === '') return undefined
  const n = parseUint(s, min, U32)
  return typeof n === 'number' ? n : { error: n }
}

/**
 * Converts a pattern draft into the wire pattern. Resolves to `undefined` when
 * the field is a blank single value (omitted so the daemon default applies).
 */
export function buildPattern(
  draft: PatternDraft,
  spec: FieldSpec,
): Result<Pattern<Scalar> | undefined> {
  const errors: string[] = []
  const scalar = (raw: string, what: string): Scalar => {
    if (raw.trim() === '') {
      errors.push(`${spec.label}: ${what} is required`)
      return ''
    }
    const v = parseScalar(raw, spec)
    if (isError(v)) {
      errors.push(`${spec.label}: ${what} ${v.error}`)
      return ''
    }
    return v
  }
  const optional = (raw: string, what: string, min: number): number | undefined => {
    const v = parseOptional(raw, min)
    if (typeof v === 'object') {
      errors.push(`${spec.label}: ${what} ${v.error}`)
      return undefined
    }
    return v
  }

  let pattern: Pattern<Scalar> | undefined
  switch (draft.choice) {
    case 'value':
      pattern =
        draft.value.trim() === '' ? undefined : { choice: 'value', value: scalar(draft.value, 'value') }
      break
    case 'values': {
      const items = draft.values
        .split(',')
        .map((s) => s.trim())
        .filter((s) => s !== '')
      if (items.length === 0) errors.push(`${spec.label}: at least one value is required`)
      pattern = { choice: 'values', values: items.map((s) => scalar(s, 'value')) }
      break
    }
    case 'increment':
    case 'decrement':
      pattern = {
        choice: draft.choice,
        [draft.choice]: {
          start: scalar(draft.start, 'start'),
          step: scalar(draft.step, 'step'),
          count: optional(draft.count, 'count', 1),
        },
      }
      break
    case 'random':
      pattern = {
        choice: 'random',
        random: {
          min: scalar(draft.min, 'min'),
          max: scalar(draft.max, 'max'),
          seed: optional(draft.seed, 'seed', 0),
          count: optional(draft.count, 'count', 1),
        },
      }
      break
  }
  return errors.length > 0 ? { ok: false, errors } : { ok: true, value: pattern }
}

const str = (v: Scalar | null | undefined): string => (v === null || v === undefined ? '' : String(v))

/** Converts a wire pattern (possibly absent) back into an editable draft. */
export function patternToDraft(pattern: Pattern<Scalar> | null | undefined): PatternDraft {
  const draft = emptyPattern()
  if (pattern === null || pattern === undefined) return draft
  const choice = pattern.choice ?? 'value'
  const counter = choice === 'increment' ? pattern.increment : pattern.decrement
  return {
    ...draft,
    choice,
    value: str(pattern.value),
    values: (pattern.values ?? []).map(str).join(', '),
    start: str(counter?.start),
    step: str(counter?.step),
    count: str(choice === 'random' ? pattern.random?.count : counter?.count),
    min: str(pattern.random?.min),
    max: str(pattern.random?.max),
    seed: str(pattern.random?.seed),
  }
}

// ---------------------------------------------------------------------------
// Flow drafts
// ---------------------------------------------------------------------------

export type L3Choice = 'ipv4' | 'ipv6' | 'arp'

/** `none` omits `Flow.rate`, which pktflow treats as "send at full speed". */
export type RateDraftChoice = 'none' | RateChoice

export interface FlowDraft {
  name: string
  tx_name: string
  rx_names: string[]
  vlan: boolean
  l3: L3Choice
  fields: Record<FieldKey, PatternDraft>
  /** Frame size in bytes including FCS; blank = daemon default (64). */
  size: string
  rate_choice: RateDraftChoice
  rate_value: string
  duration: DurationChoice
  packets: string
}

function emptyFields(): Record<FieldKey, PatternDraft> {
  const keys = Object.keys(FIELD_SPECS) as FieldKey[]
  return Object.fromEntries(keys.map((k) => [k, emptyPattern()])) as Record<FieldKey, PatternDraft>
}

export function emptyFlowDraft(txName = ''): FlowDraft {
  return {
    name: '',
    tx_name: txName,
    rx_names: [],
    vlan: false,
    l3: 'ipv4',
    fields: emptyFields(),
    size: '',
    rate_choice: 'none',
    rate_value: '',
    duration: 'continuous',
    packets: '',
  }
}

/** Reads a header's field pattern from the loosely-typed wire object. */
function headerPattern(header: Header | undefined, spec: FieldSpec): Pattern<Scalar> | undefined {
  const body = header?.[spec.header] as Record<string, Pattern<Scalar> | null | undefined> | null | undefined
  return body?.[spec.field] ?? undefined
}

/** Converts a configured flow into an editable draft. */
export function flowToDraft(flow: Flow): FlowDraft {
  const find = (choice: HeaderChoice) => flow.packet.find((h) => h.choice === choice)
  const l3Header = flow.packet.find(
    (h): h is Header & { choice: L3Choice } =>
      h.choice === 'ipv4' || h.choice === 'ipv6' || h.choice === 'arp',
  )
  const fields = emptyFields()
  for (const key of Object.keys(FIELD_SPECS) as FieldKey[]) {
    const spec: FieldSpec = FIELD_SPECS[key]
    fields[key] = patternToDraft(headerPattern(find(spec.header), spec))
  }
  const rate = flow.rate ?? null
  return {
    name: flow.name,
    tx_name: flow.tx_rx.port?.tx_name ?? '',
    rx_names: flow.tx_rx.port?.rx_names ?? [],
    vlan: find('vlan') !== undefined,
    l3: l3Header?.choice ?? 'ipv4',
    fields,
    size: str(flow.size?.fixed),
    rate_choice: rate === null ? 'none' : rate.choice,
    rate_value: rate === null ? '' : str(rate[rate.choice]),
    duration: flow.duration?.choice ?? 'continuous',
    packets: str(flow.duration?.fixed_packets?.packets),
  }
}

/** Builds one header from the draft, omitting fields left at their defaults. */
function buildHeader(choice: HeaderChoice, draft: FlowDraft): Result<Header> {
  const errors: string[] = []
  const body: Record<string, Pattern<Scalar>> = {}
  for (const key of HEADER_FIELDS[choice]) {
    const res = buildPattern(draft.fields[key], FIELD_SPECS[key])
    if (!res.ok) errors.push(...res.errors)
    else if (res.value !== undefined) body[FIELD_SPECS[key].field] = res.value
  }
  return errors.length > 0 ? { ok: false, errors } : { ok: true, value: { choice, [choice]: body } }
}

/** Validates the draft and converts it into a wire flow. */
export function draftToFlow(draft: FlowDraft): Result<Flow> {
  const errors: string[] = []
  const name = draft.name.trim()
  if (name === '') errors.push('Name is required')
  if (draft.tx_name === '') errors.push('Tx port is required')

  const choices: HeaderChoice[] = ['ethernet', ...(draft.vlan ? (['vlan'] as const) : []), draft.l3]
  const packet: Header[] = []
  for (const choice of choices) {
    const res = buildHeader(choice, draft)
    if (res.ok) packet.push(res.value)
    else errors.push(...res.errors)
  }

  const flow: Flow = {
    name,
    tx_rx: { choice: 'port', port: { tx_name: draft.tx_name, rx_names: draft.rx_names } },
    packet,
  }

  if (draft.size.trim() !== '') {
    const size = parseUint(draft.size.trim(), 1, U32)
    if (typeof size === 'number') flow.size = { choice: 'fixed', fixed: size }
    else errors.push(`Frame size ${size}`)
  }

  if (draft.rate_choice !== 'none') {
    const rate = parseUint(draft.rate_value.trim(), 1, Number.MAX_SAFE_INTEGER)
    if (typeof rate === 'number') {
      flow.rate = { choice: draft.rate_choice, [draft.rate_choice]: rate }
    } else {
      errors.push(`Rate ${rate}`)
    }
  }

  if (draft.duration === 'fixed_packets') {
    const packets = parseUint(draft.packets.trim(), 1, Number.MAX_SAFE_INTEGER)
    if (typeof packets === 'number') {
      flow.duration = { choice: 'fixed_packets', fixed_packets: { packets } }
    } else {
      errors.push(`Packets ${packets}`)
    }
  } else {
    flow.duration = { choice: 'continuous' }
  }

  return errors.length > 0 ? { ok: false, errors } : { ok: true, value: flow }
}

// ---------------------------------------------------------------------------
// Display helpers
// ---------------------------------------------------------------------------

/** One-line rendering of a pattern, e.g. `10.0.0.1 +0.0.0.1 ×10`. */
export function summarizePattern(pattern: Pattern<Scalar> | null | undefined): string | undefined {
  if (pattern === null || pattern === undefined) return undefined
  switch (pattern.choice ?? 'value') {
    case 'value':
      return str(pattern.value)
    case 'values':
      return `[${(pattern.values ?? []).map(str).join(', ')}]`
    case 'increment':
      return `${str(pattern.increment?.start)} +${str(pattern.increment?.step)} ×${str(pattern.increment?.count ?? 1)}`
    case 'decrement':
      return `${str(pattern.decrement?.start)} −${str(pattern.decrement?.step)} ×${str(pattern.decrement?.count ?? 1)}`
    case 'random':
      return `random ${str(pattern.random?.min)}–${str(pattern.random?.max)}`
  }
}

/** Summarizes a header's source → destination addresses, when it has them. */
export function summarizeAddresses(flow: Flow, choice: HeaderChoice): string | undefined {
  const header = flow.packet.find((h) => h.choice === choice)
  if (header === undefined) return undefined
  const [srcKey, dstKey] = HEADER_FIELDS[choice]
  if (dstKey === undefined) return undefined
  const src = summarizePattern(headerPattern(header, FIELD_SPECS[srcKey])) ?? FIELD_SPECS[srcKey].placeholder
  const dst = summarizePattern(headerPattern(header, FIELD_SPECS[dstKey])) ?? FIELD_SPECS[dstKey].placeholder
  return `${src} → ${dst}`
}

export function describeRate(flow: Flow): string {
  const rate = flow.rate ?? null
  if (rate === null) return 'full speed'
  const value = rate[rate.choice]
  return `${value === null || value === undefined ? '?' : value.toLocaleString()} ${rate.choice}`
}

export function describeDuration(flow: Flow): string {
  const d = flow.duration ?? null
  if (d === null || d.choice === 'continuous') return 'continuous'
  return `${(d.fixed_packets?.packets ?? 1).toLocaleString()} packets`
}

export function describeSize(flow: Flow): string {
  return `${flow.size?.fixed ?? 64} B`
}
