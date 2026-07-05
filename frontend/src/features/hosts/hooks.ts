import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { addHost, listHosts, removeHost } from '../../api/hosts.ts'
import type { AddHostRequest } from '../../api/types.ts'
import { toast } from '../../stores/toastStore.ts'
import { useHostStore } from '../../stores/hostStore.ts'

const HOSTS_KEY = ['hosts'] as const

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

/** The configured hosts, served by the backend. */
export function useHosts() {
  return useQuery({ queryKey: HOSTS_KEY, queryFn: listHosts })
}

/**
 * The host the UI currently targets. Falls back to the first host until the user
 * makes an explicit choice, and self-heals to the first host if the selected one
 * disappears (e.g. after removal). `null` only while the list is still loading.
 */
export function useActiveHostId(): string | null {
  const { data: hosts } = useHosts()
  const selected = useHostStore((state) => state.activeHostId)
  if (!hosts || hosts.length === 0) return null
  if (selected !== null && hosts.some((host) => host.id === selected)) return selected
  return hosts[0].id
}

export function useAddHost() {
  const queryClient = useQueryClient()
  const setActiveHost = useHostStore((state) => state.setActiveHost)
  return useMutation({
    mutationFn: (req: AddHostRequest) => addHost(req),
    onSuccess: (host) => {
      toast.success(`Added host ${host.label}`)
      setActiveHost(host.id)
      void queryClient.invalidateQueries({ queryKey: HOSTS_KEY })
    },
    onError: (error) => toast.error(errorMessage(error)),
  })
}

export function useRemoveHost() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => removeHost(id),
    onSuccess: () => {
      toast.success('Removed host')
      void queryClient.invalidateQueries({ queryKey: HOSTS_KEY })
    },
    onError: (error) => toast.error(errorMessage(error)),
  })
}
