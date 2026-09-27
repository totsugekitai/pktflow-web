import { useState } from 'react'
import { FlowList } from './features/flows/FlowList.tsx'
import { PortList } from './features/ports/PortList.tsx'
import { HostSelector } from './features/hosts/HostSelector.tsx'
import { HostManager } from './features/hosts/HostManager.tsx'
import { ToastContainer } from './components/Toast.tsx'
import { Modal } from './components/Modal.tsx'
import styles from './App.module.css'

export function App() {
  const [manageOpen, setManageOpen] = useState(false)

  return (
    <div className={styles.app}>
      <header className={styles.topbar}>
        <h1 className={styles.brand}>pktflow</h1>
        <span className={styles.subtitle}>daemon control</span>
        <HostSelector onManage={() => setManageOpen(true)} />
      </header>
      <main className={styles.main}>
        <PortList />
        <FlowList />
      </main>
      {manageOpen && (
        <Modal title="Manage hosts" onClose={() => setManageOpen(false)}>
          <HostManager />
        </Modal>
      )}
      <ToastContainer />
    </div>
  )
}
