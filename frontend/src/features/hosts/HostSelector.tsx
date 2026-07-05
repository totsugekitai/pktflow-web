import { useHostStore } from '../../stores/hostStore.ts'
import { useActiveHostId, useHosts } from './hooks.ts'
import styles from './HostSelector.module.css'

export interface HostSelectorProps {
  /** Opens the host-management modal. */
  onManage: () => void
}

/** Header dropdown that picks which daemon host the UI targets. */
export function HostSelector({ onManage }: HostSelectorProps) {
  const { data: hosts = [] } = useHosts()
  const activeHostId = useActiveHostId()
  const setActiveHost = useHostStore((state) => state.setActiveHost)

  return (
    <div className={styles.wrap}>
      <label className={styles.field}>
        <span className={styles.label}>Host</span>
        <select
          className={styles.select}
          value={activeHostId ?? ''}
          disabled={hosts.length === 0}
          onChange={(e) => setActiveHost(e.target.value)}
        >
          {hosts.map((host) => (
            <option key={host.id} value={host.id}>
              {host.label}
            </option>
          ))}
        </select>
      </label>
      <button type="button" className={styles.manage} onClick={onManage}>
        Manage hosts
      </button>
    </div>
  )
}
