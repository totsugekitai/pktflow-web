import { describe, expect, it } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import type { Config } from '../../api/types.ts'
import { makeConfig, makePort, makePortMetric, server } from '../../test/server.ts'
import { renderWithClient } from '../../test/helpers.ts'
import { PortCard } from './PortCard.tsx'

/** Waits until the active host is known, which every action needs. */
async function waitForHost(queryClient: ReturnType<typeof renderWithClient>['queryClient']) {
  await waitFor(() => expect(queryClient.getQueryData(['hosts'])).toBeDefined())
}

describe('PortCard', () => {
  it('renders the port name, PCI address, and queue settings', () => {
    renderWithClient(
      <PortCard
        port={makePort({ name: 'p2', location: '0000:02:00.1?rxq=2&txq=1&rxd=2048' })}
        metric={undefined}
      />,
    )
    expect(screen.getByRole('heading', { name: 'p2' })).toBeInTheDocument()
    expect(screen.getByText('0000:02:00.1')).toBeInTheDocument()
    expect(screen.getByText('rxq 2 · txq 1 · rxd 2048')).toBeInTheDocument()
  })

  it('shows counters from the port metrics', () => {
    renderWithClient(
      <PortCard port={makePort()} metric={makePortMetric({ frames_rx: 1002, frames_tx_rate: 99.6 })} />,
    )
    expect(screen.getByText('1,002')).toBeInTheDocument()
    expect(screen.getByText('100/s')).toBeInTheDocument()
  })

  it('reflects the link state', () => {
    const { rerender } = renderWithClient(
      <PortCard port={makePort()} metric={makePortMetric({ link: 'up' })} />,
    )
    expect(screen.getByRole('img', { name: 'Link up' })).toBeInTheDocument()

    rerender(<PortCard port={makePort()} metric={makePortMetric({ link: 'down' })} />)
    expect(screen.getByRole('img', { name: 'Link down' })).toBeInTheDocument()

    rerender(<PortCard port={makePort()} metric={undefined} />)
    expect(screen.getByRole('img', { name: 'Link status unknown' })).toBeInTheDocument()
  })

  it('takes the link down via control/state', async () => {
    let received: unknown
    server.use(
      http.post('/api/hosts/:id/control/state', async ({ request }) => {
        received = await request.json()
        return HttpResponse.json({ warnings: [] })
      }),
    )
    const { queryClient } = renderWithClient(
      <PortCard port={makePort()} metric={makePortMetric({ link: 'up' })} />,
    )
    await waitForHost(queryClient)

    await userEvent.click(screen.getByRole('button', { name: 'Link down' }))
    await waitFor(() =>
      expect(received).toEqual({
        choice: 'port',
        port: { choice: 'link', link: { port_names: ['p1'], state: 'down' } },
      }),
    )
  })

  it('adds a capture to the config before starting one', async () => {
    const calls: string[] = []
    let posted: Config | undefined
    server.use(
      http.get('/api/hosts/:id/config', () => HttpResponse.json(makeConfig({ ports: [makePort()] }))),
      http.post('/api/hosts/:id/config', async ({ request }) => {
        calls.push('config')
        posted = (await request.json()) as Config
        return HttpResponse.json({ warnings: [] })
      }),
      http.post('/api/hosts/:id/control/state', () => {
        calls.push('state')
        return HttpResponse.json({ warnings: [] })
      }),
    )
    const { queryClient } = renderWithClient(<PortCard port={makePort()} metric={makePortMetric()} />)
    await waitForHost(queryClient)

    await userEvent.click(screen.getByRole('button', { name: 'Start Capture' }))
    await waitFor(() => expect(calls).toEqual(['config', 'state']))
    expect(posted?.captures).toEqual([{ name: 'capture-p1', port_names: ['p1'], format: 'pcapng' }])
  })

  it('disables Delete while transmitting or capturing', () => {
    const { rerender } = renderWithClient(
      <PortCard port={makePort()} metric={makePortMetric({ transmit: 'started' })} />,
    )
    expect(screen.getByRole('button', { name: 'Delete' })).toBeDisabled()

    rerender(<PortCard port={makePort()} metric={makePortMetric({ capture: 'started' })} />)
    expect(screen.getByRole('button', { name: 'Delete' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Stop Capture' })).toBeInTheDocument()

    rerender(<PortCard port={makePort()} metric={makePortMetric()} />)
    expect(screen.getByRole('button', { name: 'Delete' })).toBeEnabled()
  })
})
