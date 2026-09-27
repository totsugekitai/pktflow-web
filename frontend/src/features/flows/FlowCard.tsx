import type { Flow, FlowMetric } from '../../api/types.ts'
import { Badge } from '../../components/Badge.tsx'
import { Button } from '../../components/Button.tsx'
import { formatCount, formatRate } from '../../components/format.ts'
import { MetricGrid } from '../../components/MetricGrid.tsx'
import {
  describeDuration,
  describeRate,
  describeSize,
  summarizeAddresses,
} from './flowDraft.ts'
import { useRemoveFlow, useSetFlowTransmit } from './hooks.ts'
import styles from './FlowCard.module.css'

export interface FlowCardProps {
  flow: Flow
  /** Absent until the first metrics poll includes this flow. */
  metric: FlowMetric | undefined
  onEdit: () => void
}

export function FlowCard({ flow, metric, onEdit }: FlowCardProps) {
  const { name } = flow
  const running = metric?.transmit === 'started'
  const port = flow.tx_rx.port
  const rx = port === null || port.rx_names.length === 0 ? '—' : port.rx_names.join(', ')
  const l3 = flow.packet.find((h) => h.choice === 'ipv4' || h.choice === 'ipv6' || h.choice === 'arp')

  const transmit = useSetFlowTransmit()
  const removeFlow = useRemoveFlow()

  const details: [string, string | undefined][] = [
    ['Ports', `${port?.tx_name ?? '?'} → ${rx}`],
    ['Headers', flow.packet.map((h) => h.choice).join(' / ')],
    ['MAC', summarizeAddresses(flow, 'ethernet')],
    ['IP', l3 === undefined ? undefined : summarizeAddresses(flow, l3.choice)],
    ['Transmit', `${describeSize(flow)} · ${describeRate(flow)} · ${describeDuration(flow)}`],
  ]

  return (
    <article className={styles.card}>
      <header className={styles.header}>
        <div className={styles.title}>
          <h3 className={styles.name}>{name}</h3>
          <Badge tone={running ? 'on' : 'off'}>{running ? 'running' : 'stopped'}</Badge>
        </div>
        <Button
          variant="danger"
          disabled={running || removeFlow.isPending}
          title={running ? 'Stop the flow before deleting' : undefined}
          onClick={() => removeFlow.mutate(name)}
        >
          Delete
        </Button>
      </header>

      <dl className={styles.details}>
        {details
          .filter((d): d is [string, string] => d[1] !== undefined)
          .map(([key, value]) => (
            <div key={key} className={styles.detail}>
              <dt>{key}</dt>
              <dd>{value}</dd>
            </div>
          ))}
      </dl>

      {metric && (
        <MetricGrid
          rows={[
            ['frames_tx', formatCount(metric.frames_tx)],
            ['bytes_tx', formatCount(metric.bytes_tx)],
            ['frames_tx_rate', formatRate(metric.frames_tx_rate)],
          ]}
        />
      )}

      <div className={styles.controls}>
        {running ? (
          <Button
            variant="secondary"
            disabled={transmit.isPending}
            onClick={() => transmit.mutate({ names: [name], state: 'stop' })}
          >
            Stop
          </Button>
        ) : (
          <Button
            disabled={transmit.isPending}
            onClick={() => transmit.mutate({ names: [name], state: 'start' })}
          >
            Start
          </Button>
        )}
        <Button
          variant="secondary"
          disabled={running}
          title={running ? 'Stop the flow before editing' : undefined}
          onClick={onEdit}
        >
          Edit
        </Button>
      </div>
    </article>
  )
}
