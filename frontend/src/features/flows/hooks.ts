import { useQuery } from '@tanstack/react-query'
import { getFlowMetrics, setControlState, updateConfig } from '../../api/otg.ts'
import type { Flow, TransmitState } from '../../api/types.ts'
import { removeFlow, saveFlow } from '../../otg/configOps.ts'
import { metricsKey, POLL_INTERVAL_MS, useOtgAction } from '../config/hooks.ts'
import { useActiveHostId } from '../hosts/hooks.ts'

/** Live metrics of every flow on the active host. */
export function useFlowMetrics() {
  const hostId = useActiveHostId()
  return useQuery({
    queryKey: metricsKey(hostId, 'flow'),
    queryFn: () => getFlowMetrics(hostId!),
    enabled: hostId !== null,
    refetchInterval: POLL_INTERVAL_MS,
  })
}

/** Adds a flow, or replaces `originalName` when editing an existing one. */
export function useSaveFlow() {
  return useOtgAction(
    (hostId, { flow, originalName }: { flow: Flow; originalName?: string }) =>
      updateConfig(hostId, (c) => saveFlow(c, flow, originalName)),
    ({ flow, originalName }) =>
      originalName === undefined ? `Added flow ${flow.name}` : `Saved flow ${flow.name}`,
  )
}

export function useRemoveFlow() {
  return useOtgAction(
    (hostId, name: string) => updateConfig(hostId, (c) => removeFlow(c, name)),
    (name) => `Removed flow ${name}`,
  )
}

/** Starts or stops the named flows; an empty list means every flow. */
export function useSetFlowTransmit() {
  return useOtgAction(
    (hostId, { names, state }: { names: string[]; state: TransmitState }) =>
      setControlState(hostId, {
        choice: 'traffic',
        traffic: { choice: 'flow_transmit', flow_transmit: { flow_names: names, state } },
      }),
    ({ names, state }) =>
      `${state === 'start' ? 'Started' : 'Stopped'} ${names.length === 0 ? 'all flows' : names.join(', ')}`,
  )
}
