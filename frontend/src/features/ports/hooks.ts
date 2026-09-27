import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getCapture, getPortMetrics, setControlState, updateConfig } from '../../api/otg.ts'
import type { Port } from '../../api/types.ts'
import { addPort, ensureCapture, removePort } from '../../otg/configOps.ts'
import { toast } from '../../stores/toastStore.ts'
import {
  errorMessage,
  metricsKey,
  POLL_INTERVAL_MS,
  useOtgAction,
} from '../config/hooks.ts'
import { useActiveHostId } from '../hosts/hooks.ts'

/** Live metrics of every port on the active host. */
export function usePortMetrics() {
  const hostId = useActiveHostId()
  return useQuery({
    queryKey: metricsKey(hostId, 'port'),
    queryFn: () => getPortMetrics(hostId!),
    enabled: hostId !== null,
    refetchInterval: POLL_INTERVAL_MS,
  })
}

export function useAddPort() {
  return useOtgAction(
    (hostId, port: Port) => updateConfig(hostId, (c) => addPort(c, port)),
    (port) => `Added port ${port.name}`,
  )
}

export function useRemovePort() {
  return useOtgAction(
    (hostId, name: string) => updateConfig(hostId, (c) => removePort(c, name)),
    (name) => `Removed port ${name}`,
  )
}

export function useSetLink() {
  return useOtgAction(
    (hostId, { name, up }: { name: string; up: boolean }) =>
      setControlState(hostId, {
        choice: 'port',
        port: { choice: 'link', link: { port_names: [name], state: up ? 'up' : 'down' } },
      }),
    ({ name, up }) => `Link ${up ? 'up' : 'down'} on ${name}`,
  )
}

/**
 * Starts a capture, first adding a capture entry to the config if none covers
 * the port yet (the daemon only captures on configured capture ports).
 */
export function useStartCapture() {
  return useOtgAction(
    async (hostId, name: string) => {
      const configWarnings = await updateConfig(hostId, (c) => ensureCapture(c, name))
      const stateWarnings = await setControlState(hostId, {
        choice: 'port',
        port: { choice: 'capture', capture: { port_names: [name], state: 'start' } },
      })
      return [...configWarnings, ...stateWarnings]
    },
    (name) => `Capture started on ${name}`,
  )
}

export function useStopCapture() {
  return useOtgAction(
    (hostId, name: string) =>
      setControlState(hostId, {
        choice: 'port',
        port: { choice: 'capture', capture: { port_names: [name], state: 'stop' } },
      }),
    (name) => `Capture stopped on ${name}`,
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

/**
 * Fetches the port's latest capture and saves it as `<port>.pcapng`. The daemon
 * stops a running capture first, so metrics are refreshed afterwards.
 */
export function useDownloadCapture() {
  const queryClient = useQueryClient()
  const hostId = useActiveHostId()
  return useMutation({
    mutationFn: (name: string) => {
      if (hostId === null) return Promise.reject(new Error('No host selected'))
      return getCapture(hostId, name)
    },
    onSuccess: (blob, name) => {
      saveBlob(blob, `${name}.pcapng`)
      toast.success(`Downloaded capture for ${name}`)
    },
    onError: (error) => toast.error(errorMessage(error)),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: metricsKey(hostId) })
    },
  })
}
