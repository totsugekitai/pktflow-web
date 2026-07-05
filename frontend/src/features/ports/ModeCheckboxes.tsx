import type { PortMode } from '../../api/types.ts'
import styles from './ModeCheckboxes.module.css'

export interface ModeCheckboxesProps {
  value: PortMode
  onChange: (mode: PortMode) => void
  /** Disables the whole group (e.g. while tasks are running). */
  disabled?: boolean
}

const KEYS: (keyof PortMode)[] = ['tx', 'rx', 'pcap']

/** A tri-checkbox group for a {@link PortMode}. */
export function ModeCheckboxes({ value, onChange, disabled = false }: ModeCheckboxesProps) {
  return (
    <fieldset className={styles.group} disabled={disabled}>
      {KEYS.map((key) => (
        <label key={key} className={styles.item}>
          <input
            type="checkbox"
            checked={value[key]}
            onChange={(e) => onChange({ ...value, [key]: e.target.checked })}
          />
          {key}
        </label>
      ))}
    </fieldset>
  )
}
