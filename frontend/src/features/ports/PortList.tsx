import { useState } from 'react'
import { Button } from '../../components/Button.tsx'
import { Modal } from '../../components/Modal.tsx'
import { useConfig } from '../config/hooks.ts'
import { AddPortForm } from './AddPortForm.tsx'
import { PortCard } from './PortCard.tsx'
import { usePortMetrics } from './hooks.ts'
import styles from './PortList.module.css'

export function PortList() {
  const { data: config, isPending, isError, error } = useConfig()
  const { data: metrics } = usePortMetrics()
  const [addOpen, setAddOpen] = useState(false)

  const ports = config ? [...config.ports].sort((a, b) => a.name.localeCompare(b.name)) : undefined

  return (
    <section className={styles.section}>
      <header className={styles.header}>
        <h2 className={styles.title}>Ports</h2>
        <Button onClick={() => setAddOpen(true)}>Add port</Button>
      </header>

      {isPending && <p className={styles.status}>Loading ports…</p>}
      {isError && (
        <p className={styles.error} role="alert">
          Failed to load config: {error instanceof Error ? error.message : String(error)}
        </p>
      )}
      {ports && ports.length === 0 && (
        <p className={styles.status}>No ports yet. Add one to get started.</p>
      )}
      {ports && ports.length > 0 && (
        <div className={styles.grid}>
          {ports.map((port) => (
            <PortCard
              key={port.name}
              port={port}
              metric={metrics?.find((m) => m.name === port.name)}
            />
          ))}
        </div>
      )}

      {addOpen && (
        <Modal title="Add port" onClose={() => setAddOpen(false)}>
          <AddPortForm
            existingNames={config?.ports.map((p) => p.name) ?? []}
            onDone={() => setAddOpen(false)}
          />
        </Modal>
      )}
    </section>
  )
}
