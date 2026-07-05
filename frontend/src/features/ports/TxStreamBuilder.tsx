import type { ArpOp, Protocol, Stream } from '../../api/types.ts'
import { Button } from '../../components/Button.tsx'
import type { RateUnit, StreamDraft } from '../../stores/txDraftStore.ts'
import { emptyDraft, useTxDraftStore } from '../../stores/txDraftStore.ts'
import { useStartTx } from './hooks.ts'
import styles from './TxStreamBuilder.module.css'

export interface TxStreamBuilderProps {
  pci: string
  onDone: () => void
}

/** Parses an optional numeric field; blank means "use the daemon default". */
function optNum(value: string): number | undefined {
  const trimmed = value.trim()
  if (trimmed === '') return undefined
  const n = Number(trimmed)
  return Number.isFinite(n) ? n : undefined
}

/**
 * Maps the exclusive rate selector to the daemon's `rate_pps`/`rate_mbps`
 * fields. Returns an empty object for full-speed or a blank/invalid value.
 */
function buildRate(draft: StreamDraft): { rate_pps?: number; rate_mbps?: number } {
  if (draft.rate_unit === 'none') return {}
  const value = optNum(draft.rate_value)
  if (value === undefined) return {}
  return draft.rate_unit === 'pps' ? { rate_pps: value } : { rate_mbps: value }
}

function buildStream(draft: StreamDraft): Stream {
  const base = {
    src_mac: draft.src_mac.trim(),
    dst_mac: draft.dst_mac.trim(),
    src_ip: draft.src_ip.trim(),
    dst_ip: draft.dst_ip.trim(),
    vlan: optNum(draft.vlan),
    count: optNum(draft.count),
    payload_len: optNum(draft.payload_len),
    ...buildRate(draft),
  }
  switch (draft.protocol) {
    case 'ipv4':
      return { protocol: 'ipv4', ...base, ttl: optNum(draft.ttl), l4_protocol: optNum(draft.l4_protocol) }
    case 'ipv6':
      return {
        protocol: 'ipv6',
        ...base,
        hop_limit: optNum(draft.hop_limit),
        l4_protocol: optNum(draft.l4_protocol),
      }
    case 'arp':
      return { protocol: 'arp', ...base, arp_op: draft.arp_op }
  }
}

function isComplete(draft: StreamDraft): boolean {
  return (
    draft.src_mac.trim() !== '' &&
    draft.dst_mac.trim() !== '' &&
    draft.src_ip.trim() !== '' &&
    draft.dst_ip.trim() !== ''
  )
}

interface StreamFieldsProps {
  index: number
  draft: StreamDraft
  onChange: (patch: Partial<StreamDraft>) => void
  onRemove: (() => void) | undefined
}

function StreamFields({ index, draft, onChange, onRemove }: StreamFieldsProps) {
  return (
    <fieldset className={styles.stream}>
      <legend className={styles.legend}>
        Stream #{index + 1}
        {onRemove && (
          <button type="button" className={styles.remove} onClick={onRemove}>
            Remove
          </button>
        )}
      </legend>

      <div className={styles.grid}>
        <label className={styles.field}>
          <span className={styles.label}>Protocol</span>
          <select
            className={styles.input}
            value={draft.protocol}
            onChange={(e) => onChange({ protocol: e.target.value as Protocol })}
          >
            <option value="ipv4">ipv4</option>
            <option value="ipv6">ipv6</option>
            <option value="arp">arp</option>
          </select>
        </label>

        <label className={styles.field}>
          <span className={styles.label}>Count</span>
          <input
            className={styles.input}
            type="number"
            min={1}
            placeholder="1"
            value={draft.count}
            onChange={(e) => onChange({ count: e.target.value })}
          />
        </label>

        <label className={styles.field}>
          <span className={styles.label}>Src MAC</span>
          <input
            className={styles.input}
            value={draft.src_mac}
            placeholder="00:11:22:33:44:55"
            onChange={(e) => onChange({ src_mac: e.target.value })}
          />
        </label>
        <label className={styles.field}>
          <span className={styles.label}>Dst MAC</span>
          <input
            className={styles.input}
            value={draft.dst_mac}
            placeholder="66:77:88:99:aa:bb"
            onChange={(e) => onChange({ dst_mac: e.target.value })}
          />
        </label>

        <label className={styles.field}>
          <span className={styles.label}>Src IP</span>
          <input
            className={styles.input}
            value={draft.src_ip}
            placeholder="10.0.0.1"
            onChange={(e) => onChange({ src_ip: e.target.value })}
          />
        </label>
        <label className={styles.field}>
          <span className={styles.label}>Dst IP</span>
          <input
            className={styles.input}
            value={draft.dst_ip}
            placeholder="10.0.0.2"
            onChange={(e) => onChange({ dst_ip: e.target.value })}
          />
        </label>

        <label className={styles.field}>
          <span className={styles.label}>VLAN</span>
          <input
            className={styles.input}
            type="number"
            min={0}
            max={4095}
            placeholder="none"
            value={draft.vlan}
            onChange={(e) => onChange({ vlan: e.target.value })}
          />
        </label>
        <label className={styles.field}>
          <span className={styles.label}>Payload len</span>
          <input
            className={styles.input}
            type="number"
            min={0}
            max={1500}
            placeholder="64"
            value={draft.payload_len}
            onChange={(e) => onChange({ payload_len: e.target.value })}
          />
        </label>

        <label className={styles.field}>
          <span className={styles.label}>Rate</span>
          <select
            className={styles.input}
            value={draft.rate_unit}
            onChange={(e) => onChange({ rate_unit: e.target.value as RateUnit })}
          >
            <option value="none">Full speed</option>
            <option value="pps">pps</option>
            <option value="mbps">Mbps</option>
          </select>
        </label>
        {draft.rate_unit !== 'none' && (
          <label className={styles.field}>
            <span className={styles.label}>
              {draft.rate_unit === 'pps' ? 'Rate (pps)' : 'Rate (Mbps)'}
            </span>
            <input
              className={styles.input}
              type="number"
              min={0}
              step={draft.rate_unit === 'mbps' ? 'any' : 1}
              placeholder={draft.rate_unit === 'pps' ? '10000' : '100.5'}
              value={draft.rate_value}
              onChange={(e) => onChange({ rate_value: e.target.value })}
            />
          </label>
        )}

        {draft.protocol === 'ipv4' && (
          <label className={styles.field}>
            <span className={styles.label}>TTL</span>
            <input
              className={styles.input}
              type="number"
              min={0}
              max={255}
              placeholder="64"
              value={draft.ttl}
              onChange={(e) => onChange({ ttl: e.target.value })}
            />
          </label>
        )}
        {draft.protocol === 'ipv6' && (
          <label className={styles.field}>
            <span className={styles.label}>Hop limit</span>
            <input
              className={styles.input}
              type="number"
              min={0}
              max={255}
              placeholder="64"
              value={draft.hop_limit}
              onChange={(e) => onChange({ hop_limit: e.target.value })}
            />
          </label>
        )}
        {draft.protocol !== 'arp' && (
          <label className={styles.field}>
            <span className={styles.label}>L4 protocol</span>
            <input
              className={styles.input}
              type="number"
              min={0}
              max={255}
              placeholder="253"
              value={draft.l4_protocol}
              onChange={(e) => onChange({ l4_protocol: e.target.value })}
            />
          </label>
        )}
        {draft.protocol === 'arp' && (
          <label className={styles.field}>
            <span className={styles.label}>ARP op</span>
            <select
              className={styles.input}
              value={draft.arp_op}
              onChange={(e) => onChange({ arp_op: e.target.value as ArpOp })}
            >
              <option value="request">request</option>
              <option value="reply">reply</option>
            </select>
          </label>
        )}
      </div>
    </fieldset>
  )
}

export function TxStreamBuilder({ pci, onDone }: TxStreamBuilderProps) {
  const stored = useTxDraftStore((s) => s.draftsByPci[pci])
  const setDrafts = useTxDraftStore((s) => s.setDrafts)
  const startTx = useStartTx()

  // Carried over from the last time this port's form was open; falls back to a
  // single blank stream on first use.
  const drafts = stored ?? [emptyDraft()]

  const patchDraft = (index: number, patch: Partial<StreamDraft>) => {
    setDrafts(pci, drafts.map((d, i) => (i === index ? { ...d, ...patch } : d)))
  }
  const removeDraft = (index: number) => {
    setDrafts(pci, drafts.filter((_, i) => i !== index))
  }
  const addDraft = () => setDrafts(pci, [...drafts, emptyDraft()])

  const canSubmit = drafts.length > 0 && drafts.every(isComplete)

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    if (!canSubmit) return
    const streams = drafts.map(buildStream)
    startTx.mutate({ pci, streams }, { onSuccess: onDone })
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit}>
      {drafts.map((draft, index) => (
        <StreamFields
          key={index}
          index={index}
          draft={draft}
          onChange={(patch) => patchDraft(index, patch)}
          onRemove={drafts.length > 1 ? () => removeDraft(index) : undefined}
        />
      ))}

      <div className={styles.actions}>
        <Button type="button" variant="secondary" onClick={addDraft}>
          Add stream
        </Button>
        <Button type="submit" disabled={!canSubmit || startTx.isPending}>
          {startTx.isPending ? 'Starting…' : 'Start Tx'}
        </Button>
      </div>
    </form>
  )
}
