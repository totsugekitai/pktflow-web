import { useState } from 'react'
import { Button } from '../../components/Button.tsx'
import { Modal } from '../../components/Modal.tsx'
import { AddPortForm } from './AddPortForm.tsx'
import { PortCard } from './PortCard.tsx'
import { usePorts } from './hooks.ts'
import styles from './PortList.module.css'

export function PortList() {
  const { data: ports, isPending, isError, error } = usePorts()
  const [addOpen, setAddOpen] = useState(false)

  return (
    <section className={styles.section}>
      <header className={styles.header}>
        <h2 className={styles.title}>Ports</h2>
        <Button onClick={() => setAddOpen(true)}>Add port</Button>
      </header>

      {isPending && <p className={styles.status}>Loading ports…</p>}
      {isError && (
        <p className={styles.error} role="alert">
          Failed to load ports: {error instanceof Error ? error.message : String(error)}
        </p>
      )}
      {ports && ports.length === 0 && (
        <p className={styles.status}>No ports yet. Add one to get started.</p>
      )}
      {ports && ports.length > 0 && (
        <div className={styles.grid}>
          {ports.map((port) => (
            <PortCard key={port.pci} port={port} />
          ))}
        </div>
      )}

      {addOpen && (
        <Modal title="Add port" onClose={() => setAddOpen(false)}>
          <AddPortForm onDone={() => setAddOpen(false)} />
        </Modal>
      )}
    </section>
  )
}
