import { useState } from 'react'
import { Button } from '../../components/Button.tsx'
import { DEFAULT_RXD, DEFAULT_RXQ, DEFAULT_TXQ, formatLocation } from '../../otg/location.ts'
import { useAddPort } from './hooks.ts'
import styles from './AddPortForm.module.css'

export interface AddPortFormProps {
  /** Names already in use, to suggest a free default name. */
  existingNames: readonly string[]
  /** Called after a port is successfully added. */
  onDone: () => void
}

/** First of `p1`, `p2`, … not already taken. */
function suggestName(existing: readonly string[]): string {
  let i = 1
  while (existing.includes(`p${i}`)) i++
  return `p${i}`
}

export function AddPortForm({ existingNames, onDone }: AddPortFormProps) {
  const [name, setName] = useState(() => suggestName(existingNames))
  const [pci, setPci] = useState('')
  const [rxq, setRxq] = useState(DEFAULT_RXQ)
  const [txq, setTxq] = useState(DEFAULT_TXQ)
  const [rxd, setRxd] = useState(DEFAULT_RXD)
  const addPort = useAddPort()

  const canSubmit = name.trim() !== '' && pci.trim() !== ''

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    if (!canSubmit) return
    addPort.mutate(
      { name: name.trim(), location: formatLocation({ pci: pci.trim(), rxq, txq, rxd }) },
      { onSuccess: onDone },
    )
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit}>
      <div className={styles.row}>
        <label className={styles.field}>
          <span className={styles.label}>Name</span>
          <input
            className={styles.input}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="p1"
            required
          />
        </label>
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
      </div>

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

      <p className={styles.note}>
        Queue counts are fixed once the port is added; delete and re-add the port to change them.
      </p>

      <div className={styles.actions}>
        <Button type="submit" disabled={addPort.isPending || !canSubmit}>
          {addPort.isPending ? 'Adding…' : 'Add port'}
        </Button>
      </div>
    </form>
  )
}
