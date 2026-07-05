import { useState } from 'react'
import type { PortStatus } from '../../api/types.ts'
import { Badge } from '../../components/Badge.tsx'
import { Button } from '../../components/Button.tsx'
import { Modal } from '../../components/Modal.tsx'
import {
  useDownloadPcap,
  useRemovePort,
  useStartPcap,
  useStartRx,
  useStopPcap,
  useStopRx,
  useStopTx,
} from './hooks.ts'
import { ModeEditor } from './ModeEditor.tsx'
import { StatsPanel } from './StatsPanel.tsx'
import { TxStreamBuilder } from './TxStreamBuilder.tsx'
import styles from './PortCard.module.css'

export interface PortCardProps {
  port: PortStatus
}

type OpenModal = 'mode' | 'tx' | null

export function PortCard({ port }: PortCardProps) {
  const { pci, link_up, mode, running, pcap_ready } = port
  const [openModal, setOpenModal] = useState<OpenModal>(null)
  const [showStats, setShowStats] = useState(false)

  const linkDotClass =
    link_up === true ? styles.linkUp : link_up === false ? styles.linkDown : styles.linkUnknown
  const linkLabel =
    link_up === true ? 'Link up' : link_up === false ? 'Link down' : 'Link status unknown'

  const removePort = useRemovePort()
  const startRx = useStartRx()
  const stopRx = useStopRx()
  const startPcap = useStartPcap()
  const stopPcap = useStopPcap()
  const stopTx = useStopTx()
  const downloadPcap = useDownloadPcap()

  const anyRunning = running.tx || running.rx || running.pcap

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
          <h3 className={styles.pci}>{pci}</h3>
        </div>
        <Button
          variant="danger"
          disabled={anyRunning || removePort.isPending}
          onClick={() => removePort.mutate(pci)}
        >
          Delete
        </Button>
      </header>

      <div className={styles.badges}>
        <span className={styles.badgeLabel}>Mode</span>
        <Badge tone={mode.tx ? 'on' : 'off'}>tx</Badge>
        <Badge tone={mode.rx ? 'on' : 'off'}>rx</Badge>
        <Badge tone={mode.pcap ? 'on' : 'off'}>pcap</Badge>
      </div>

      <div className={styles.badges}>
        <span className={styles.badgeLabel}>Running</span>
        <Badge tone={running.tx ? 'on' : 'off'}>tx</Badge>
        <Badge tone={running.rx ? 'on' : 'off'}>rx</Badge>
        <Badge tone={running.pcap ? 'on' : 'off'}>pcap</Badge>
        {pcap_ready && <Badge tone="ready">pcap ready</Badge>}
      </div>

      <div className={styles.controls}>
        {running.tx ? (
          <Button variant="secondary" disabled={stopTx.isPending} onClick={() => stopTx.mutate(pci)}>
            Stop Tx
          </Button>
        ) : (
          <Button disabled={!mode.tx} onClick={() => setOpenModal('tx')}>
            Start Tx…
          </Button>
        )}

        {running.rx ? (
          <Button variant="secondary" disabled={stopRx.isPending} onClick={() => stopRx.mutate(pci)}>
            Stop Rx
          </Button>
        ) : (
          <Button disabled={!mode.rx || startRx.isPending} onClick={() => startRx.mutate(pci)}>
            Start Rx
          </Button>
        )}

        {running.pcap ? (
          <Button
            variant="secondary"
            disabled={stopPcap.isPending}
            onClick={() => stopPcap.mutate(pci)}
          >
            Stop Capture
          </Button>
        ) : (
          <Button disabled={!mode.pcap || startPcap.isPending} onClick={() => startPcap.mutate(pci)}>
            Start Capture
          </Button>
        )}

        <Button
          variant="secondary"
          disabled={!pcap_ready || downloadPcap.isPending}
          onClick={() => downloadPcap.mutate(pci)}
        >
          Download pcap
        </Button>

        <Button variant="secondary" disabled={anyRunning} onClick={() => setOpenModal('mode')}>
          Edit mode
        </Button>

        <Button
          variant="secondary"
          aria-expanded={showStats}
          onClick={() => setShowStats((v) => !v)}
        >
          {showStats ? 'Hide stats' : 'Show stats'}
        </Button>
      </div>

      {showStats && <StatsPanel pci={pci} />}

      {openModal === 'tx' && (
        <Modal title={`Start Tx — ${pci}`} onClose={() => setOpenModal(null)}>
          <TxStreamBuilder pci={pci} onDone={() => setOpenModal(null)} />
        </Modal>
      )}
      {openModal === 'mode' && (
        <Modal title={`Edit mode — ${pci}`} onClose={() => setOpenModal(null)}>
          <ModeEditor pci={pci} initialMode={mode} onDone={() => setOpenModal(null)} />
        </Modal>
      )}
    </article>
  )
}
