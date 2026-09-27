import type { Port, PortMetric } from '../../api/types.ts'
import { Badge } from '../../components/Badge.tsx'
import { Button } from '../../components/Button.tsx'
import { formatCount, formatRate } from '../../components/format.ts'
import { MetricGrid, type MetricRow } from '../../components/MetricGrid.tsx'
import { parseLocation } from '../../otg/location.ts'
import {
  useDownloadCapture,
  useRemovePort,
  useSetLink,
  useStartCapture,
  useStopCapture,
} from './hooks.ts'
import styles from './PortCard.module.css'

export interface PortCardProps {
  port: Port
  /** Absent until the first metrics poll includes this port. */
  metric: PortMetric | undefined
}

function metricRows(m: PortMetric): MetricRow[] {
  return [
    ['frames_tx', formatCount(m.frames_tx)],
    ['frames_rx', formatCount(m.frames_rx)],
    ['bytes_tx', formatCount(m.bytes_tx)],
    ['bytes_rx', formatCount(m.bytes_rx)],
    ['frames_tx_rate', formatRate(m.frames_tx_rate)],
    ['frames_rx_rate', formatRate(m.frames_rx_rate)],
    ['bytes_tx_rate', formatRate(m.bytes_tx_rate)],
    ['bytes_rx_rate', formatRate(m.bytes_rx_rate)],
  ]
}

export function PortCard({ port, metric }: PortCardProps) {
  const { name } = port
  const location = parseLocation(port.location)

  const link = metric?.link
  const linkDotClass =
    link === 'up' ? styles.linkUp : link === 'down' ? styles.linkDown : styles.linkUnknown
  const linkLabel =
    link === 'up' ? 'Link up' : link === 'down' ? 'Link down' : 'Link status unknown'
  const capturing = metric?.capture === 'started'
  const transmitting = metric?.transmit === 'started'

  const removePort = useRemovePort()
  const setLink = useSetLink()
  const startCapture = useStartCapture()
  const stopCapture = useStopCapture()
  const downloadCapture = useDownloadCapture()

  return (
    <article className={styles.card}>
      <header className={styles.header}>
        <div className={styles.title}>
          <span
            className={`${styles.linkDot} ${linkDotClass}`}
            role="img"
            aria-label={linkLabel}
            title={linkLabel}
          />
          <h3 className={styles.name}>{name}</h3>
          <span className={styles.pci}>{location.pci}</span>
        </div>
        <Button
          variant="danger"
          disabled={transmitting || capturing || removePort.isPending}
          title={transmitting || capturing ? 'Stop Tx and capture before deleting' : undefined}
          onClick={() => removePort.mutate(name)}
        >
          Delete
        </Button>
      </header>

      <p className={styles.queues}>
        rxq {location.rxq} · txq {location.txq} · rxd {location.rxd}
      </p>

      <div className={styles.badges}>
        <span className={styles.badgeLabel}>State</span>
        <Badge tone={transmitting ? 'on' : 'off'}>tx</Badge>
        <Badge tone={capturing ? 'on' : 'off'}>capture</Badge>
      </div>

      {metric && <MetricGrid rows={metricRows(metric)} />}

      <div className={styles.controls}>
        {link === 'up' ? (
          <Button
            variant="secondary"
            disabled={setLink.isPending}
            onClick={() => setLink.mutate({ name, up: false })}
          >
            Link down
          </Button>
        ) : (
          <Button
            variant="secondary"
            disabled={setLink.isPending}
            onClick={() => setLink.mutate({ name, up: true })}
          >
            Link up
          </Button>
        )}

        {capturing ? (
          <Button
            variant="secondary"
            disabled={stopCapture.isPending}
            onClick={() => stopCapture.mutate(name)}
          >
            Stop Capture
          </Button>
        ) : (
          <Button disabled={startCapture.isPending} onClick={() => startCapture.mutate(name)}>
            Start Capture
          </Button>
        )}

        <Button
          variant="secondary"
          disabled={downloadCapture.isPending}
          title={capturing ? 'Stops the running capture and downloads it' : undefined}
          onClick={() => downloadCapture.mutate(name)}
        >
          Download pcap
        </Button>
      </div>
    </article>
  )
}
