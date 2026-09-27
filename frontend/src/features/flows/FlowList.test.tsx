import { describe, expect, it } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import type { Config } from '../../api/types.ts'
import {
  daemonHandlers,
  makeConfig,
  makeFlow,
  makeFlowMetric,
  makePort,
  server,
} from '../../test/server.ts'
import { renderWithClient } from '../../test/helpers.ts'
import { FlowList } from './FlowList.tsx'

const ports = [makePort({ name: 'p1' }), makePort({ name: 'p2', location: '0000:02:00.1' })]

describe('FlowList', () => {
  it('disables Add flow until a port exists', async () => {
    renderWithClient(<FlowList />)
    expect(await screen.findByText(/no flows yet/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Add flow' })).toBeDisabled()
  })

  it('renders flows with their summary and metrics', async () => {
    server.use(
      ...daemonHandlers(makeConfig({ ports, flows: [makeFlow()] }), {
        flows: [makeFlowMetric({ transmit: 'started', frames_tx: 4242 })],
      }),
    )
    renderWithClient(<FlowList />)

    expect(await screen.findByRole('heading', { name: 'f1' })).toBeInTheDocument()
    expect(screen.getByText('p1 → p2')).toBeInTheDocument()
    expect(screen.getByText('10.0.0.1 → 10.0.0.2')).toBeInTheDocument()
    expect(await screen.findByText('4,242')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Stop' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Edit' })).toBeDisabled()
  })

  it('starts a single flow via flow_transmit', async () => {
    let received: unknown
    server.use(
      ...daemonHandlers(makeConfig({ ports, flows: [makeFlow()] }), { flows: [makeFlowMetric()] }),
      http.post('/api/hosts/:id/control/state', async ({ request }) => {
        received = await request.json()
        return HttpResponse.json({ warnings: [] })
      }),
    )
    renderWithClient(<FlowList />)
    await screen.findByRole('heading', { name: 'f1' })

    await userEvent.click(screen.getByRole('button', { name: 'Start' }))
    await waitFor(() =>
      expect(received).toEqual({
        choice: 'traffic',
        traffic: { choice: 'flow_transmit', flow_transmit: { flow_names: ['f1'], state: 'start' } },
      }),
    )
  })

  it('adds a flow with an incrementing source IP through the editor', async () => {
    let posted: Config | undefined
    server.use(
      ...daemonHandlers(makeConfig({ ports })),
      http.post('/api/hosts/:id/config', async ({ request }) => {
        posted = (await request.json()) as Config
        return HttpResponse.json({ warnings: [] })
      }),
    )
    renderWithClient(<FlowList />)
    const addButton = screen.getByRole('button', { name: 'Add flow' })
    await waitFor(() => expect(addButton).toBeEnabled())

    await userEvent.click(addButton)
    const dialog = within(screen.getByRole('dialog', { name: 'Add flow' }))
    await userEvent.type(dialog.getByPlaceholderText('f1'), 'f1')
    await userEvent.click(dialog.getByRole('checkbox', { name: 'p2' }))
    await userEvent.type(dialog.getByLabelText('Src MAC value'), '00:11:22:33:44:55')
    await userEvent.type(dialog.getByLabelText('Dst MAC value'), '66:77:88:99:aa:bb')
    await userEvent.selectOptions(dialog.getByLabelText('Src IP pattern'), 'increment')
    await userEvent.type(dialog.getByLabelText('Src IP start'), '10.0.0.1')
    await userEvent.type(dialog.getByLabelText('Src IP step'), '0.0.0.1')
    await userEvent.type(dialog.getByLabelText('Src IP count'), '10')
    await userEvent.type(dialog.getByLabelText('Dst IP value'), '10.0.0.2')
    await userEvent.click(dialog.getByRole('button', { name: 'Add flow' }))

    await waitFor(() => expect(posted?.flows).toHaveLength(1))
    expect(posted?.flows[0]).toEqual({
      ...makeFlow(),
      packet: [
        makeFlow().packet[0],
        {
          choice: 'ipv4',
          ipv4: {
            src: { choice: 'increment', increment: { start: '10.0.0.1', step: '0.0.0.1', count: 10 } },
            dst: { choice: 'value', value: '10.0.0.2' },
          },
        },
      ],
    })
    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: 'Add flow' })).not.toBeInTheDocument(),
    )
  })

  it('shows validation errors instead of posting an invalid flow', async () => {
    let posted = false
    server.use(
      ...daemonHandlers(makeConfig({ ports })),
      http.post('/api/hosts/:id/config', () => {
        posted = true
        return HttpResponse.json({ warnings: [] })
      }),
    )
    renderWithClient(<FlowList />)
    const addButton = screen.getByRole('button', { name: 'Add flow' })
    await waitFor(() => expect(addButton).toBeEnabled())

    await userEvent.click(addButton)
    const dialog = within(screen.getByRole('dialog', { name: 'Add flow' }))
    await userEvent.type(dialog.getByLabelText('Src MAC value'), 'nope')
    await userEvent.click(dialog.getByRole('button', { name: 'Add flow' }))

    const alert = await dialog.findByRole('alert')
    expect(alert).toHaveTextContent('Name is required')
    expect(alert).toHaveTextContent('Src MAC: value "nope" is not a MAC address')
    expect(posted).toBe(false)
  })
})
