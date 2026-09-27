import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getConfig } from '../../api/otg.ts'
import { toast } from '../../stores/toastStore.ts'
import { useActiveHostId } from '../hosts/hooks.ts'

/** How often live daemon state (config and metrics) is refetched. */
export const POLL_INTERVAL_MS = 2000

/** The daemon config is keyed per host so switching hosts refetches cleanly. */
export function configKey(hostId: string | null) {
  return ['config', hostId] as const
}

/** Metrics are keyed per host; the prefix `['metrics', hostId]` covers both kinds. */
export function metricsKey(hostId: string | null, kind?: 'port' | 'flow') {
  return kind === undefined ? (['metrics', hostId] as const) : (['metrics', hostId, kind] as const)
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

/**
 * The active host's OTG config (ports, captures, flows), polled so changes
 * made by other clients show up too.
 */
export function useConfig() {
  const hostId = useActiveHostId()
  return useQuery({
    queryKey: configKey(hostId),
    queryFn: () => getConfig(hostId!),
    enabled: hostId !== null,
    refetchInterval: POLL_INTERVAL_MS,
  })
}

/**
 * Wraps an OTG action so success refreshes config and metrics, and every
 * outcome — including daemon warnings — surfaces as a toast. The active host is
 * injected, so callers only pass action-specific arguments.
 */
export function useOtgAction<TArgs>(
  action: (hostId: string, args: TArgs) => Promise<string[]>,
  successMessage: (args: TArgs) => string,
) {
  const queryClient = useQueryClient()
  const hostId = useActiveHostId()
  return useMutation({
    mutationFn: (args: TArgs) => {
      if (hostId === null) return Promise.reject(new Error('No host selected'))
      return action(hostId, args)
    },
    onSuccess: (warnings, args) => {
      toast.success(successMessage(args))
      for (const warning of warnings) toast.error(`Warning: ${warning}`)
    },
    onError: (error) => toast.error(errorMessage(error)),
    // Refresh on failure too: a partially applied action may have changed state.
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: configKey(hostId) })
      void queryClient.invalidateQueries({ queryKey: metricsKey(hostId) })
    },
  })
}
