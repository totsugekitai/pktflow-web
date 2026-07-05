import { create } from 'zustand'

/**
 * Tracks only which host the UI currently targets. The host list itself is
 * server state owned by the backend (see `features/hosts/hooks.ts`); this store
 * holds nothing but the user's selection.
 *
 * `activeHostId` is `null` until the user picks a host or the list resolves and
 * a default is derived — see {@link useActiveHostId}.
 */
interface HostSelectionState {
  activeHostId: string | null
  setActiveHost: (id: string) => void
}

export const useHostStore = create<HostSelectionState>()((set) => ({
  activeHostId: null,
  setActiveHost: (id) => set({ activeHostId: id }),
}))
