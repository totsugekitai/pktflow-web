import { beforeEach, describe, expect, it } from 'vitest'
import { useHostStore } from './hostStore.ts'

/** Resets the singleton selection store between tests. */
function resetHostStore(): void {
  useHostStore.setState({ activeHostId: null })
}

describe('hostStore', () => {
  beforeEach(resetHostStore)

  it('starts without an explicit selection', () => {
    expect(useHostStore.getState().activeHostId).toBeNull()
  })

  it('records the selected host id', () => {
    useHostStore.getState().setActiveHost('host-2')
    expect(useHostStore.getState().activeHostId).toBe('host-2')
  })
})
