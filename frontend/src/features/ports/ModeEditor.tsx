import { useState } from 'react'
import type { PortMode } from '../../api/types.ts'
import { Button } from '../../components/Button.tsx'
import { useSetMode } from './hooks.ts'
import { ModeCheckboxes } from './ModeCheckboxes.tsx'
import styles from './ModeEditor.module.css'

export interface ModeEditorProps {
  pci: string
  initialMode: PortMode
  onDone: () => void
}

export function ModeEditor({ pci, initialMode, onDone }: ModeEditorProps) {
  const [mode, setMode] = useState<PortMode>(initialMode)
  const setModeMutation = useSetMode()

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    setModeMutation.mutate({ pci, mode }, { onSuccess: onDone })
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit}>
      <p className={styles.note}>
        The mode can only be changed while all tasks are stopped. Disabled
        capabilities are set to off.
      </p>
      <ModeCheckboxes value={mode} onChange={setMode} />
      <div className={styles.actions}>
        <Button type="submit" disabled={setModeMutation.isPending}>
          {setModeMutation.isPending ? 'Saving…' : 'Save mode'}
        </Button>
      </div>
    </form>
  )
}
