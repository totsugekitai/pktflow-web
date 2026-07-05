import type { PortStats } from '../../api/types.ts'
import { usePortStats } from './hooks.ts'
import styles from './StatsPanel.module.css'

export interface StatsPanelProps {
  pci: string
}

/** A labelled counter row: `[label, value]`. */
type StatRow = readonly [string, number]

function hwRows(hw: PortStats['hw']): StatRow[] {
  return [
    ['rx_packets', hw.rx_packets],
    ['tx_packets', hw.tx_packets],
    ['rx_bytes', hw.rx_bytes],
    ['tx_bytes', hw.tx_bytes],
    ['rx_missed', hw.rx_missed],
    ['rx_errors', hw.rx_errors],
    ['tx_errors', hw.tx_errors],
    ['rx_nombuf', hw.rx_nombuf],
  ]
}

function swRows(sw: PortStats['sw']): StatRow[] {
  return [
    ['rx_frames', sw.rx_frames],
    ['tx_frames', sw.tx_frames],
    ['rx_bytes', sw.rx_bytes],
    ['tx_bytes', sw.tx_bytes],
  ]
}

function StatGroup({ label, rows }: { label: string; rows: StatRow[] }) {
  return (
    <div className={styles.group}>
      <span className={styles.groupLabel}>{label}</span>
      <div className={styles.grid}>
        {rows.map(([key, value]) => (
          <div key={key} className={styles.row}>
            <span className={styles.key}>{key}</span>
            <span className={styles.value}>{value.toLocaleString()}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

/** Live hw/sw counters for a port. Mounted only while the section is expanded. */
export function StatsPanel({ pci }: StatsPanelProps) {
  const { data, isPending, isError, error } = usePortStats(pci, true)

  if (isPending) {
    return <p className={styles.message}>Loading stats…</p>
  }
  if (isError) {
    return (
      <p className={styles.error} role="alert">
        {error instanceof Error ? error.message : 'Failed to load stats'}
      </p>
    )
  }

  return (
    <div className={styles.panel}>
      <StatGroup label="HW (NIC)" rows={hwRows(data.hw)} />
      <StatGroup label="SW (worker)" rows={swRows(data.sw)} />
    </div>
  )
}
