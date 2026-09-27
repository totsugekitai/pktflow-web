import { useState } from 'react'
import type { Flow } from '../../api/types.ts'
import { Button } from '../../components/Button.tsx'
import { Modal } from '../../components/Modal.tsx'
import { useConfig } from '../config/hooks.ts'
import { FlowCard } from './FlowCard.tsx'
import { FlowEditor } from './FlowEditor.tsx'
import { useFlowMetrics, useSetFlowTransmit } from './hooks.ts'
import styles from './FlowList.module.css'

/** Which editor modal is open: a new flow, an existing one, or none. */
type Editing = { kind: 'add' } | { kind: 'edit'; flow: Flow } | null

export function FlowList() {
  const { data: config, isPending, isError } = useConfig()
  const { data: metrics } = useFlowMetrics()
  const transmit = useSetFlowTransmit()
  const [editing, setEditing] = useState<Editing>(null)

  // The daemon returns flows in no particular order; keep the list stable.
  const flows = config ? [...config.flows].sort((a, b) => a.name.localeCompare(b.name)) : undefined
  const portNames = config?.ports.map((p) => p.name).sort() ?? []
  const anyRunning = metrics?.some((m) => m.transmit === 'started') ?? false

  return (
    <section className={styles.section}>
      <header className={styles.header}>
        <h2 className={styles.title}>Flows</h2>
        <div className={styles.actions}>
          <Button
            variant="secondary"
            disabled={!flows || flows.length === 0 || transmit.isPending}
            onClick={() => transmit.mutate({ names: [], state: 'start' })}
          >
            Start all
          </Button>
          <Button
            variant="secondary"
            disabled={!anyRunning || transmit.isPending}
            onClick={() => transmit.mutate({ names: [], state: 'stop' })}
          >
            Stop all
          </Button>
          <Button
            disabled={portNames.length === 0}
            title={portNames.length === 0 ? 'Add a port first' : undefined}
            onClick={() => setEditing({ kind: 'add' })}
          >
            Add flow
          </Button>
        </div>
      </header>

      {/* Loading and error states are already reported by the Ports section. */}
      {!isPending && !isError && flows && flows.length === 0 && (
        <p className={styles.status}>No flows yet. Add a port, then define a flow to transmit.</p>
      )}
      {flows && flows.length > 0 && (
        <div className={styles.grid}>
          {flows.map((flow) => (
            <FlowCard
              key={flow.name}
              flow={flow}
              metric={metrics?.find((m) => m.name === flow.name)}
              onEdit={() => setEditing({ kind: 'edit', flow })}
            />
          ))}
        </div>
      )}

      {editing && (
        <Modal
          title={editing.kind === 'add' ? 'Add flow' : `Edit flow — ${editing.flow.name}`}
          size="wide"
          onClose={() => setEditing(null)}
        >
          <FlowEditor
            portNames={portNames}
            initial={editing.kind === 'edit' ? editing.flow : undefined}
            onDone={() => setEditing(null)}
          />
        </Modal>
      )}
    </section>
  )
}
