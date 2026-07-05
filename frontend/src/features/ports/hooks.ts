import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  addPort,
  downloadPcap,
  getStats,
  listPorts,
  removePort,
  setMode,
  startPcap,
  startRx,
  startTx,
  stopPcap,
  stopRx,
  stopTx,
} from '../../api/ports.ts'
import type { AddPortRequest, PortMode, Stream } from '../../api/types.ts'
import { toast } from '../../stores/toastStore.ts'
import { useActiveHostId } from '../hosts/hooks.ts'

/** Port queries are keyed per host so switching hosts refetches cleanly. */
function portsKey(hostId: string | null) {
  return ['ports', hostId] as const
}

/** Stats are keyed per host and port so each card polls independently. */
function statsKey(hostId: string | null, pci: string) {
  return ['ports', hostId, pci, 'stats'] as const
}

/** How often the port list is refetched while the page is open. */
const POLL_INTERVAL_MS = 2000

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

/** Live list of ports for the active host, polled so running-state changes appear. */
export function usePorts() {
  const hostId = useActiveHostId()
  return useQuery({
    queryKey: portsKey(hostId),
    queryFn: () => listPorts(hostId!),
    enabled: hostId !== null,
    refetchInterval: POLL_INTERVAL_MS,
  })
}

/**
 * Live hw/sw counters for one port, polled while `enabled` (i.e. the stats
 * section is open). Kept separate from the port list so a closed card does no
 * extra fetching.
 */
export function usePortStats(pci: string, enabled: boolean) {
  const hostId = useActiveHostId()
  return useQuery({
    queryKey: statsKey(hostId, pci),
    queryFn: () => getStats(hostId!, pci),
    enabled: enabled && hostId !== null,
    refetchInterval: POLL_INTERVAL_MS,
  })
}

/**
 * Wraps a port action so success refreshes the port list and both outcomes
 * surface a toast — no result is silently dropped. The active host is injected,
 * so callers only pass the port-specific arguments.
 */
function usePortAction<TArgs>(
  action: (hostId: string, args: TArgs) => Promise<void>,
  successMessage: (args: TArgs) => string,
) {
  const queryClient = useQueryClient()
  const hostId = useActiveHostId()
  return useMutation({
    mutationFn: (args: TArgs) => {
      if (hostId === null) return Promise.reject(new Error('No host selected'))
      return action(hostId, args)
    },
    onSuccess: (_result, args) => {
      toast.success(successMessage(args))
      void queryClient.invalidateQueries({ queryKey: portsKey(hostId) })
    },
    onError: (error) => toast.error(errorMessage(error)),
  })
}

export function useAddPort() {
  return usePortAction(
    (hostId, req: AddPortRequest) => addPort(hostId, req),
    (req) => `Added port ${req.pci}`,
  )
}

export function useRemovePort() {
  return usePortAction(
    (hostId, pci: string) => removePort(hostId, pci),
    (pci) => `Removed port ${pci}`,
  )
}

export function useSetMode() {
  return usePortAction(
    (hostId, { pci, mode }: { pci: string; mode: PortMode }) => setMode(hostId, pci, mode),
    ({ pci }) => `Updated mode for ${pci}`,
  )
}

export function useStartTx() {
  return usePortAction(
    (hostId, { pci, streams }: { pci: string; streams: Stream[] }) =>
      startTx(hostId, pci, streams),
    ({ pci }) => `Tx started on ${pci}`,
  )
}

export function useStopTx() {
  return usePortAction(
    (hostId, pci: string) => stopTx(hostId, pci),
    (pci) => `Tx stopped on ${pci}`,
  )
}

export function useStartRx() {
  return usePortAction(
    (hostId, pci: string) => startRx(hostId, pci),
    (pci) => `Rx started on ${pci}`,
  )
}

export function useStopRx() {
  return usePortAction(
    (hostId, pci: string) => stopRx(hostId, pci),
    (pci) => `Rx stopped on ${pci}`,
  )
}

export function useStartPcap() {
  return usePortAction(
    (hostId, pci: string) => startPcap(hostId, pci),
    (pci) => `Capture started on ${pci}`,
  )
}

export function useStopPcap() {
  return usePortAction(
    (hostId, pci: string) => stopPcap(hostId, pci),
    (pci) => `Capture stopped on ${pci}`,
  )
}

/** Triggers a browser download for a Blob under the given filename. */
function saveBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}

/** Fetches a finished capture for the active host and saves it as `<pci>.pcapng`. */
export function useDownloadPcap() {
  const hostId = useActiveHostId()
  return useMutation({
    mutationFn: (pci: string) => {
      if (hostId === null) return Promise.reject(new Error('No host selected'))
      return downloadPcap(hostId, pci)
    },
    onSuccess: (blob, pci) => {
      saveBlob(blob, `${pci}.pcapng`)
      toast.success(`Downloaded capture for ${pci}`)
    },
    onError: (error) => toast.error(errorMessage(error)),
  })
}
