import { useState } from 'react'
import type { DurationChoice, Flow, HeaderChoice } from '../../api/types.ts'
import { Button } from '../../components/Button.tsx'
import {
  draftToFlow,
  emptyFlowDraft,
  FIELD_SPECS,
  type FlowDraft,
  flowToDraft,
  HEADER_FIELDS,
  type L3Choice,
  type PatternDraft,
  type RateDraftChoice,
} from './flowDraft.ts'
import { useSaveFlow } from './hooks.ts'
import { PatternField } from './PatternField.tsx'
import styles from './FlowEditor.module.css'

export interface FlowEditorProps {
  /** Names of the configured ports, for the Tx/Rx selectors. */
  portNames: readonly string[]
  /** The flow being edited; absent when adding a new one. */
  initial?: Flow
  onDone: () => void
}

const HEADER_TITLES: Record<HeaderChoice, string> = {
  ethernet: 'Ethernet',
  vlan: 'VLAN',
  ipv4: 'IPv4',
  ipv6: 'IPv6',
  arp: 'ARP',
}

export function FlowEditor({ portNames, initial, onDone }: FlowEditorProps) {
  const [draft, setDraft] = useState<FlowDraft>(() =>
    initial === undefined ? emptyFlowDraft(portNames[0] ?? '') : flowToDraft(initial),
  )
  const [errors, setErrors] = useState<string[]>([])
  const saveFlow = useSaveFlow()

  const patch = (p: Partial<FlowDraft>) => setDraft((d) => ({ ...d, ...p }))
  const patchField = (key: keyof FlowDraft['fields'], p: Partial<PatternDraft>) =>
    setDraft((d) => ({ ...d, fields: { ...d.fields, [key]: { ...d.fields[key], ...p } } }))
  const toggleRx = (name: string, checked: boolean) =>
    setDraft((d) => ({
      ...d,
      rx_names: checked ? [...d.rx_names, name] : d.rx_names.filter((n) => n !== name),
    }))

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    const result = draftToFlow(draft)
    if (!result.ok) {
      setErrors(result.errors)
      return
    }
    setErrors([])
    saveFlow.mutate({ flow: result.value, originalName: initial?.name }, { onSuccess: onDone })
  }

  const headerSection = (choice: HeaderChoice) => (
    <fieldset className={styles.section}>
      <legend className={styles.legend}>{HEADER_TITLES[choice]}</legend>
      {HEADER_FIELDS[choice].map((key) => (
        <PatternField
          key={key}
          spec={FIELD_SPECS[key]}
          draft={draft.fields[key]}
          onChange={(p) => patchField(key, p)}
        />
      ))}
    </fieldset>
  )

  return (
    <form className={styles.form} onSubmit={handleSubmit}>
      <fieldset className={styles.section}>
        <legend className={styles.legend}>Flow</legend>
        <div className={styles.grid}>
          <label className={styles.field}>
            <span className={styles.label}>Name</span>
            <input
              className={styles.input}
              value={draft.name}
              placeholder="f1"
              onChange={(e) => patch({ name: e.target.value })}
            />
          </label>
          <label className={styles.field}>
            <span className={styles.label}>Tx port</span>
            <select
              className={styles.input}
              value={draft.tx_name}
              onChange={(e) => patch({ tx_name: e.target.value })}
            >
              {portNames.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className={styles.field}>
          <span className={styles.label}>Rx ports</span>
          <div className={styles.checks}>
            {portNames.map((name) => (
              <label key={name} className={styles.check}>
                <input
                  type="checkbox"
                  checked={draft.rx_names.includes(name)}
                  onChange={(e) => toggleRx(name, e.target.checked)}
                />
                {name}
              </label>
            ))}
          </div>
        </div>
      </fieldset>

      <fieldset className={styles.section}>
        <legend className={styles.legend}>Packet</legend>
        <div className={styles.checks}>
          <label className={styles.check}>
            <input
              type="checkbox"
              checked={draft.vlan}
              onChange={(e) => patch({ vlan: e.target.checked })}
            />
            VLAN tag
          </label>
          <label className={styles.check}>
            L3
            <select
              className={styles.input}
              aria-label="L3 protocol"
              value={draft.l3}
              onChange={(e) => patch({ l3: e.target.value as L3Choice })}
            >
              <option value="ipv4">ipv4</option>
              <option value="ipv6">ipv6</option>
              <option value="arp">arp</option>
            </select>
          </label>
        </div>
      </fieldset>

      {headerSection('ethernet')}
      {draft.vlan && headerSection('vlan')}
      {headerSection(draft.l3)}

      <fieldset className={styles.section}>
        <legend className={styles.legend}>Transmit</legend>
        <div className={styles.grid}>
          <label className={styles.field}>
            <span className={styles.label}>Frame size (bytes, incl. FCS)</span>
            <input
              className={styles.input}
              type="number"
              min={1}
              placeholder="64"
              disabled={draft.l3 === 'arp'}
              title={draft.l3 === 'arp' ? 'ARP frames have a fixed size' : undefined}
              value={draft.size}
              onChange={(e) => patch({ size: e.target.value })}
            />
          </label>
          <div className={styles.field}>
            <span className={styles.label}>Rate</span>
            <div className={styles.inline}>
              <select
                className={styles.input}
                aria-label="Rate unit"
                value={draft.rate_choice}
                onChange={(e) => patch({ rate_choice: e.target.value as RateDraftChoice })}
              >
                <option value="none">Full speed</option>
                <option value="pps">pps</option>
                <option value="bps">bps</option>
                <option value="kbps">kbps</option>
                <option value="mbps">mbps</option>
                <option value="gbps">gbps</option>
              </select>
              {draft.rate_choice !== 'none' && (
                <input
                  className={styles.input}
                  type="number"
                  min={1}
                  aria-label="Rate value"
                  placeholder="1000"
                  value={draft.rate_value}
                  onChange={(e) => patch({ rate_value: e.target.value })}
                />
              )}
            </div>
          </div>
          <div className={styles.field}>
            <span className={styles.label}>Duration</span>
            <div className={styles.inline}>
              <select
                className={styles.input}
                aria-label="Duration"
                value={draft.duration}
                onChange={(e) => patch({ duration: e.target.value as DurationChoice })}
              >
                <option value="continuous">continuous</option>
                <option value="fixed_packets">fixed packets</option>
              </select>
              {draft.duration === 'fixed_packets' && (
                <input
                  className={styles.input}
                  type="number"
                  min={1}
                  aria-label="Packets"
                  placeholder="1000"
                  value={draft.packets}
                  onChange={(e) => patch({ packets: e.target.value })}
                />
              )}
            </div>
          </div>
        </div>
      </fieldset>

      {errors.length > 0 && (
        <ul className={styles.errors} role="alert">
          {errors.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      )}

      <div className={styles.actions}>
        <Button type="submit" disabled={saveFlow.isPending}>
          {saveFlow.isPending ? 'Saving…' : initial === undefined ? 'Add flow' : 'Save flow'}
        </Button>
      </div>
    </form>
  )
}
