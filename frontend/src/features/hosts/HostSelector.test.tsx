import { beforeEach, describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { makeHost, server } from '../../test/server.ts'
import { renderWithClient } from '../../test/helpers.ts'
import { useHostStore } from '../../stores/hostStore.ts'
import { HostSelector } from './HostSelector.tsx'

/** Serves the built-in local host plus one added host. */
function twoHosts(): void {
  server.use(
    http.get('/api/hosts', () =>
      HttpResponse.json({
        hosts: [makeHost(), makeHost({ id: 'host-1', label: 'rack-2', address: 'http://10.0.0.2:7878' })],
      }),
    ),
  )
}

describe('HostSelector', () => {
  beforeEach(() => useHostStore.setState({ activeHostId: null }))

  it('lists every host from the backend', async () => {
    twoHosts()
    renderWithClient(<HostSelector onManage={() => undefined} />)

    expect(await screen.findByRole('option', { name: 'rack-2' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Local' })).toBeInTheDocument()
  })

  it('switches the active host on selection', async () => {
    twoHosts()
    renderWithClient(<HostSelector onManage={() => undefined} />)

    const rack = await screen.findByRole('option', { name: 'rack-2' })
    await userEvent.selectOptions(screen.getByRole('combobox', { name: /host/i }), rack)
    expect(useHostStore.getState().activeHostId).toBe('host-1')
  })

  it('invokes onManage when the manage button is clicked', async () => {
    const onManage = vi.fn()
    renderWithClient(<HostSelector onManage={onManage} />)

    await userEvent.click(screen.getByRole('button', { name: /manage hosts/i }))
    expect(onManage).toHaveBeenCalledOnce()
  })
})
