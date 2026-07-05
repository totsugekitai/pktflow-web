import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { ArpOp, Protocol } from '../api/types.ts'

/** How a stream's transmit rate is specified; `none` means send at full speed. */
export type RateUnit = 'none' | 'pps' | 'mbps'

/**
 * String-backed editing state for one Tx stream (parsed on submit). This is the
 * shape persisted so the Tx form can be re-opened with the previous input.
 */
export interface StreamDraft {
  protocol: Protocol
  src_mac: string
  dst_mac: string
  src_ip: string
  dst_ip: string
  count: string
  payload_len: string
  vlan: string
  ttl: string
  hop_limit: string
  l4_protocol: string
  arp_op: ArpOp
  rate_unit: RateUnit
  rate_value: string
}

export function emptyDraft(): StreamDraft {
  return {
    protocol: 'ipv4',
    src_mac: '',
    dst_mac: '',
    src_ip: '',
    dst_ip: '',
    count: '',
    payload_len: '',
    vlan: '',
    ttl: '',
    hop_limit: '',
    l4_protocol: '',
    arp_op: 'request',
    rate_unit: 'none',
    rate_value: '',
  }
}

/**
 * Remembers the last Tx stream drafts per port (keyed by PCI address) so the
 * Start Tx form carries over the previous input instead of resetting each time.
 * Persisted to localStorage, so drafts survive a page reload.
 */
interface TxDraftState {
  draftsByPci: Record<string, StreamDraft[]>
  setDrafts: (pci: string, drafts: StreamDraft[]) => void
  clearDrafts: (pci: string) => void
}

export const useTxDraftStore = create<TxDraftState>()(
  persist(
    (set) => ({
      draftsByPci: {},
      setDrafts: (pci, drafts) =>
        set((state) => ({ draftsByPci: { ...state.draftsByPci, [pci]: drafts } })),
      clearDrafts: (pci) =>
        set((state) => {
          const { [pci]: _removed, ...rest } = state.draftsByPci
          return { draftsByPci: rest }
        }),
    }),
    { name: 'pktflow-tx-drafts' },
  ),
)
