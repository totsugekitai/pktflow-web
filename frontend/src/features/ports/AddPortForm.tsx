import { useState } from 'react'
import type { PortMode } from '../../api/types.ts'
import { Button } from '../../components/Button.tsx'
import { useAddPort } from './hooks.ts'
import { ModeCheckboxes } from './ModeCheckboxes.tsx'
import styles from './AddPortForm.module.css'

export interface AddPortFormProps {
  /** Called after a port is successfully added. */
  onDone: () => void
}

const ALL_ENABLED: PortMode = { tx: true, rx: true, pcap: true }

/** Daemon default for descriptors per rx queue. */
const DEFAULT_RXD = 1024

export function AddPortForm({ onDone }: AddPortFormProps) {
  const [pci, setPci] = useState('')
  const [rxq, setRxq] = useState(1)
  const [txq, setTxq] = useState(1)
  const [rxd, setRxd] = useState(DEFAULT_RXD)
  const [mode, setMode] = useState<PortMode>(ALL_ENABLED)
  const addPort = useAddPort()

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    const trimmed = pci.trim()
    if (trimmed === '') return
    addPort.mutate({ pci: trimmed, rxq, txq, rxd, mode }, { onSuccess: onDone })
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit}>
      <label className={styles.field}>
        <span className={styles.label}>PCI address</span>
        <input
          className={styles.input}
          value={pci}
          onChange={(e) => setPci(e.target.value)}
          placeholder="0000:02:00.0"
          autoFocus
          required
        />
      </label>

      <div className={styles.row}>
        <label className={styles.field}>
          <span className={styles.label}>Rx queues</span>
          <input
            className={styles.input}
            type="number"
            min={1}
            value={rxq}
            onChange={(e) => setRxq(Number(e.target.value))}
          />
        </label>
        <label className={styles.field}>
          <span className={styles.label}>Tx queues</span>
          <input
            className={styles.input}
            type="number"
            min={1}
            value={txq}
            onChange={(e) => setTxq(Number(e.target.value))}
          />
        </label>
        <label className={styles.field}>
          <span className={styles.label}>Rx descriptors</span>
          <input
            className={styles.input}
            type="number"
            min={1}
            value={rxd}
            onChange={(e) => setRxd(Number(e.target.value))}
          />
        </label>
      </div>

      <div className={styles.field}>
        <span className={styles.label}>Mode</span>
        <ModeCheckboxes value={mode} onChange={setMode} />
      </div>

      <div className={styles.actions}>
        <Button type="submit" disabled={addPort.isPending || pci.trim() === ''}>
          {addPort.isPending ? 'Adding…' : 'Add port'}
        </Button>
      </div>
    </form>
  )
}
