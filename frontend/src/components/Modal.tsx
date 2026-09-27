import { useEffect, useId, type ReactNode } from 'react'
import styles from './Modal.module.css'

export interface ModalProps {
  title: string
  onClose: () => void
  /** `wide` fits dense forms such as the flow editor. */
  size?: 'normal' | 'wide'
  children: ReactNode
}

export function Modal({ title, onClose, size = 'normal', children }: ModalProps) {
  const titleId = useId()

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div
        className={size === 'wide' ? `${styles.dialog} ${styles.wide}` : styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={styles.header}>
          <h2 id={titleId} className={styles.title}>
            {title}
          </h2>
          <button
            type="button"
            className={styles.close}
            aria-label="Close"
            onClick={onClose}
          >
            ×
          </button>
        </div>
        <div className={styles.body}>{children}</div>
      </div>
    </div>
  )
}
