import { describe, expect, it } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { makePort, makeStats, server } from '../../test/server.ts'
import { renderWithClient } from '../../test/helpers.ts'
import { PortCard } from './PortCard.tsx'

describe('PortCard', () => {
  it('renders the PCI address and mode', () => {
    renderWithClient(<PortCard port={makePort({ pci: '0000:02:00.1' })} />)
    expect(screen.getByRole('heading', { name: '0000:02:00.1' })).toBeInTheDocument()
  })

  it('starts Rx on the active host via the daemon', async () => {
    let called = false
    server.use(
      http.post('/api/hosts/:id/ports/:pci/rx/start', () => {
        called = true
        return HttpResponse.json({ ok: true })
      }),
    )
    const { queryClient } = renderWithClient(<PortCard port={makePort()} />)
    // The action needs the active host, so wait for the host list to load first.
    await waitFor(() => expect(queryClient.getQueryData(['hosts'])).toBeDefined())

    await userEvent.click(screen.getByRole('button', { name: 'Start Rx' }))
    await waitFor(() => expect(called).toBe(true))
  })

  it('disables Start Rx when rx mode is off', () => {
    renderWithClient(
      <PortCard port={makePort({ mode: { tx: true, rx: false, pcap: true } })} />,
    )
    expect(screen.getByRole('button', { name: 'Start Rx' })).toBeDisabled()
  })

  it('reveals live stats when Show stats is toggled', async () => {
    server.use(
      http.get('/api/hosts/:id/ports/:pci/stats', () =>
        HttpResponse.json(makeStats({ hw: { ...makeStats().hw, rx_packets: 1002 } })),
      ),
    )
    renderWithClient(<PortCard port={makePort({ pci: '0000:02:00.1' })} />)

    await userEvent.click(screen.getByRole('button', { name: 'Show stats' }))
    expect(await screen.findByText('1,002')).toBeInTheDocument()
    expect(screen.getByText('HW (NIC)')).toBeInTheDocument()
  })

  it('shows a green dot labelled Link up when the link is up', () => {
    renderWithClient(<PortCard port={makePort({ link_up: true })} />)
    expect(screen.getByRole('img', { name: 'Link up' })).toBeInTheDocument()
  })

  it('shows a red dot labelled Link down when the link is down', () => {
    renderWithClient(<PortCard port={makePort({ link_up: false })} />)
    expect(screen.getByRole('img', { name: 'Link down' })).toBeInTheDocument()
  })

  it('shows an unknown link status when link state is null', () => {
    renderWithClient(<PortCard port={makePort({ link_up: null })} />)
    expect(screen.getByRole('img', { name: 'Link status unknown' })).toBeInTheDocument()
  })

  it('disables Delete while a task is running', () => {
    renderWithClient(
      <PortCard port={makePort({ running: { tx: false, rx: true, pcap: false } })} />,
    )
    expect(screen.getByRole('button', { name: 'Delete' })).toBeDisabled()
  })
})
