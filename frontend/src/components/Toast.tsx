import { useEffect } from 'react'
import { useToastStore, type Toast as ToastData } from '../stores/toastStore.ts'
import styles from './Toast.module.css'

const AUTO_DISMISS_MS = 5000

function ToastItem({ toast }: { toast: ToastData }) {
  const dismiss = useToastStore((s) => s.dismiss)

  useEffect(() => {
    const timer = setTimeout(() => dismiss(toast.id), AUTO_DISMISS_MS)
    return () => clearTimeout(timer)
  }, [toast.id, dismiss])

  return (
    <div className={`${styles.toast} ${styles[toast.tone]}`} role="status">
      <span className={styles.message}>{toast.message}</span>
      <button
        type="button"
        className={styles.close}
        aria-label="Dismiss"
        onClick={() => dismiss(toast.id)}
      >
        ×
      </button>
    </div>
  )
}

/** Renders the current toast queue; mount once near the app root. */
export function ToastContainer() {
  const toasts = useToastStore((s) => s.toasts)
  if (toasts.length === 0) return null

  return (
    <div className={styles.container}>
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} />
      ))}
    </div>
  )
}
