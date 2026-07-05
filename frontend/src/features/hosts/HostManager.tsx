import { Button } from '../../components/Button.tsx'
import { Badge } from '../../components/Badge.tsx'
import { LOCAL_HOST_ID } from '../../api/hosts.ts'
import { AddHostForm } from './AddHostForm.tsx'
import { useActiveHostId, useHosts, useRemoveHost } from './hooks.ts'
import styles from './HostManager.module.css'

/** Lists configured hosts with remove controls and an add form. */
export function HostManager() {
  const { data: hosts = [] } = useHosts()
  const activeHostId = useActiveHostId()
  const removeHost = useRemoveHost()

  return (
    <div className={styles.wrap}>
      <ul className={styles.list}>
        {hosts.map((host) => (
          <li key={host.id} className={styles.item}>
            <div className={styles.info}>
              <span className={styles.name}>
                {host.label}
                {host.id === activeHostId && <Badge tone="on">active</Badge>}
              </span>
              <span className={styles.url}>{host.address}</span>
            </div>
            {host.id !== LOCAL_HOST_ID && (
              <Button
                variant="danger"
                disabled={removeHost.isPending}
                onClick={() => removeHost.mutate(host.id)}
                aria-label={`Remove ${host.label}`}
              >
                Remove
              </Button>
            )}
          </li>
        ))}
      </ul>

      <div className={styles.addSection}>
        <h3 className={styles.addTitle}>Add host</h3>
        {/* Keep the modal open after adding so several hosts can be added in a row. */}
        <AddHostForm onDone={() => undefined} />
      </div>
    </div>
  )
}
