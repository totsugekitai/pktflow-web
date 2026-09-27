import styles from './MetricGrid.module.css'

/** A labelled metric row: `[label, formatted value]`. */
export type MetricRow = readonly [string, string]

/** A compact two-column grid of labelled metric values. */
export function MetricGrid({ rows }: { rows: readonly MetricRow[] }) {
  return (
    <div className={styles.grid}>
      {rows.map(([key, value]) => (
        <div key={key} className={styles.row}>
          <span className={styles.key}>{key}</span>
          <span className={styles.value}>{value}</span>
        </div>
      ))}
    </div>
  )
}
