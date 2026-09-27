import { describe, expect, it } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import type { Config } from '../../api/types.ts'
import {
  daemonHandlers,
  makeConfig,
  makeFlow,
  makePort,
  makePortMetric,
  server,
} from '../../test/server.ts'
import { renderWithClient } from '../../test/helpers.ts'
import { useToastStore } from '../../stores/toastStore.ts'
import { PortList } from './PortList.tsx'

describe('PortList', () => {
  it('shows the empty state when there are no ports', async () => {
    renderWithClient(<PortList />)
    expect(await screen.findByText(/no ports yet/i)).toBeInTheDocument()
  })

  it('renders a card per configured port, sorted by name, with its metrics', async () => {
    server.use(
      ...daemonHandlers(
        makeConfig({
          ports: [
            makePort({ name: 'p2', location: '0000:02:00.1' }),
            makePort({ name: 'p1', location: '0000:02:00.0' }),
          ],
        }),
        { ports: [makePortMetric({ name: 'p2', link: 'down' })] },
      ),
    )
    renderWithClient(<PortList />)

    const headings = await screen.findAllByRole('heading', { level: 3 })
    expect(headings.map((h) => h.textContent)).toEqual(['p1', 'p2'])
    expect(await screen.findByRole('img', { name: 'Link down' })).toBeInTheDocument()
  })

  it('adds a port through the modal, keeping the rest of the config', async () => {
    const existing = makeConfig({ ports: [makePort()], flows: [makeFlow({ tx_rx: { choice: 'port', port: { tx_name: 'p1', rx_names: [] } } })] })
    let posted: Config | undefined
    server.use(
      ...daemonHandlers(existing),
      http.post('/api/hosts/:id/config', async ({ request }) => {
        posted = (await request.json()) as Config
        return HttpResponse.json({ warnings: [] })
      }),
    )
    renderWithClient(<PortList />)
    await screen.findByRole('heading', { name: 'p1' })

    await userEvent.click(screen.getByRole('button', { name: 'Add port' }))
    const dialog = within(screen.getByRole('dialog', { name: 'Add port' }))
    expect(dialog.getByPlaceholderText('p1')).toHaveValue('p2')
    await userEvent.type(dialog.getByPlaceholderText('0000:02:00.0'), '0000:03:00.0')
    await userEvent.click(dialog.getByRole('button', { name: 'Add port' }))

    await waitFor(() =>
      expect(posted).toEqual({
        ...existing,
        ports: [...existing.ports, { name: 'p2', location: '0000:03:00.0?rxq=1&txq=1&rxd=1024' }],
      }),
    )
    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: 'Add port' })).not.toBeInTheDocument(),
    )
  })

  it('refuses to delete a port a flow uses, without posting the config', async () => {
    let posted = false
    server.use(
      ...daemonHandlers(makeConfig({ ports: [makePort(), makePort({ name: 'p2', location: '0000:02:00.1' })], flows: [makeFlow()] })),
      http.post('/api/hosts/:id/config', () => {
        posted = true
        return HttpResponse.json({ warnings: [] })
      }),
    )
    renderWithClient(<PortList />)
    await screen.findByRole('heading', { name: 'p1' })

    await userEvent.click(screen.getAllByRole('button', { name: 'Delete' })[0])
    // Toasts render outside PortList, so inspect the store directly.
    await waitFor(() =>
      expect(useToastStore.getState().toasts).toContainEqual(
        expect.objectContaining({
          tone: 'error',
          message: expect.stringContaining('Port "p1" is used by flow(s) "f1"'),
        }),
      ),
    )
    expect(posted).toBe(false)
  })
})
