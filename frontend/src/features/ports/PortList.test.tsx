import { describe, expect, it } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { makePort, server } from '../../test/server.ts'
import { renderWithClient } from '../../test/helpers.ts'
import { PortList } from './PortList.tsx'

describe('PortList', () => {
  it('shows the empty state when there are no ports', async () => {
    renderWithClient(<PortList />)
    expect(await screen.findByText(/no ports yet/i)).toBeInTheDocument()
  })

  it('renders a card per port', async () => {
    server.use(
      http.get('/api/hosts/:id/ports', () =>
        HttpResponse.json({
          ports: [makePort({ pci: '0000:02:00.0' }), makePort({ pci: '0000:02:00.1' })],
        }),
      ),
    )
    renderWithClient(<PortList />)

    expect(await screen.findByText('0000:02:00.0')).toBeInTheDocument()
    expect(screen.getByText('0000:02:00.1')).toBeInTheDocument()
  })

  it('adds a port through the modal', async () => {
    let posted: unknown
    server.use(
      http.post('/api/hosts/:id/ports', async ({ request }) => {
        posted = await request.json()
        return HttpResponse.json({ ok: true })
      }),
    )
    renderWithClient(<PortList />)
    await screen.findByText(/no ports yet/i)

    await userEvent.click(screen.getByRole('button', { name: 'Add port' }))
    const dialog = within(screen.getByRole('dialog', { name: 'Add port' }))
    await userEvent.type(dialog.getByPlaceholderText('0000:02:00.0'), '0000:03:00.0')
    await userEvent.click(dialog.getByRole('button', { name: 'Add port' }))

    await waitFor(() => expect(posted).toMatchObject({ pci: '0000:03:00.0' }))
    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: 'Add port' })).not.toBeInTheDocument(),
    )
  })
})
