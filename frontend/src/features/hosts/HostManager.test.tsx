import { beforeEach, describe, expect, it } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { makeHost, server } from '../../test/server.ts'
import { renderWithClient } from '../../test/helpers.ts'
import { useHostStore } from '../../stores/hostStore.ts'
import { HostManager } from './HostManager.tsx'

describe('HostManager', () => {
  beforeEach(() => useHostStore.setState({ activeHostId: null }))

  it('lists hosts from the backend', async () => {
    renderWithClient(<HostManager />)
    expect(await screen.findByText('Local')).toBeInTheDocument()
  })

  it('does not offer to remove the built-in local host', async () => {
    renderWithClient(<HostManager />)
    await screen.findByText('Local')
    expect(screen.queryByRole('button', { name: /remove local/i })).not.toBeInTheDocument()
  })

  it('adds a host through the form', async () => {
    let posted: unknown
    server.use(
      http.post('/api/hosts', async ({ request }) => {
        posted = await request.json()
        return HttpResponse.json(
          makeHost({ id: 'host-1', label: 'edge-1', address: 'http://10.0.0.9:7878' }),
          { status: 201 },
        )
      }),
    )
    renderWithClient(<HostManager />)
    await screen.findByText('Local')

    await userEvent.type(screen.getByPlaceholderText('rack-2'), 'edge-1')
    await userEvent.type(
      screen.getByPlaceholderText('http://192.168.1.10:7878'),
      'http://10.0.0.9:7878',
    )
    await userEvent.click(screen.getByRole('button', { name: 'Add host' }))

    await waitFor(() =>
      expect(posted).toEqual({ label: 'edge-1', address: 'http://10.0.0.9:7878' }),
    )
  })

  it('rejects an invalid daemon URL before calling the backend', async () => {
    renderWithClient(<HostManager />)
    await screen.findByText('Local')

    await userEvent.type(screen.getByPlaceholderText('rack-2'), 'edge-1')
    await userEvent.type(screen.getByPlaceholderText('http://192.168.1.10:7878'), 'ftp://x')
    await userEvent.click(screen.getByRole('button', { name: 'Add host' }))

    expect(screen.getByRole('alert')).toHaveTextContent(/http or https/i)
  })

  it('removes an added host', async () => {
    let deletedId = ''
    server.use(
      http.get('/api/hosts', () =>
        HttpResponse.json({
          hosts: [
            makeHost(),
            makeHost({ id: 'host-1', label: 'edge-1', address: 'http://10.0.0.9:7878' }),
          ],
        }),
      ),
      http.delete('/api/hosts/:id', ({ params }) => {
        deletedId = String(params.id)
        return new HttpResponse(null, { status: 204 })
      }),
    )
    renderWithClient(<HostManager />)
    await screen.findByText('edge-1')

    await userEvent.click(screen.getByRole('button', { name: /remove edge-1/i }))
    await waitFor(() => expect(deletedId).toBe('host-1'))
  })
})
