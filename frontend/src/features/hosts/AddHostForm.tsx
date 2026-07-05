import { useState } from 'react'
import { Button } from '../../components/Button.tsx'
import { useAddHost } from './hooks.ts'
import styles from './AddHostForm.module.css'

export interface AddHostFormProps {
  /** Called after a host is successfully added. */
  onDone: () => void
}

/** Validates the address: an absolute http(s) origin the backend can reach. */
function validateAddress(value: string): string | null {
  const trimmed = value.trim()
  if (trimmed === '') return 'Address is required'
  try {
    const url = new URL(trimmed)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return 'Address must use http or https'
    }
    return null
  } catch {
    return 'Enter a valid URL (e.g. http://192.168.1.10:7878)'
  }
}

export function AddHostForm({ onDone }: AddHostFormProps) {
  const [label, setLabel] = useState('')
  const [address, setAddress] = useState('')
  const [error, setError] = useState<string | null>(null)
  const addHost = useAddHost()

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    const trimmedLabel = label.trim()
    const trimmedAddress = address.trim()
    if (trimmedLabel === '') {
      setError('Label is required')
      return
    }
    const addressError = validateAddress(trimmedAddress)
    if (addressError !== null) {
      setError(addressError)
      return
    }
    setError(null)
    // The backend trims the trailing slash; success clears the form so several
    // hosts can be added in a row.
    addHost.mutate(
      { label: trimmedLabel, address: trimmedAddress },
      {
        onSuccess: () => {
          setLabel('')
          setAddress('')
          onDone()
        },
      },
    )
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit}>
      <label className={styles.field}>
        <span className={styles.label}>Label</span>
        <input
          className={styles.input}
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="rack-2"
          autoFocus
          required
        />
      </label>

      <label className={styles.field}>
        <span className={styles.label}>Daemon URL</span>
        <input
          className={styles.input}
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder="http://192.168.1.10:7878"
          required
        />
      </label>

      {error !== null && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}

      <div className={styles.actions}>
        <Button type="submit" disabled={addHost.isPending}>
          Add host
        </Button>
      </div>
    </form>
  )
}
