import { describe, expect, it } from 'vitest'
import { http, HttpResponse } from 'msw'
import { server, makePort, makeStats } from '../test/server.ts'
import { ApiError } from './client.ts'
import { addPort, getStats, listPorts, startTx } from './ports.ts'

const HOST = 'local'

describe('ports API', () => {
  it('unwraps the ports array from the host ports endpoint', async () => {
    const port = makePort()
    server.use(http.get('/api/hosts/:id/ports', () => HttpResponse.json({ ports: [port] })))

    await expect(listPorts(HOST)).resolves.toEqual([port])
  })

  it('scopes the request to the host and POSTs the body when adding a port', async () => {
    let hostId = ''
    let received: unknown
    server.use(
      http.post('/api/hosts/:id/ports', async ({ request, params }) => {
        hostId = String(params.id)
        received = await request.json()
        return HttpResponse.json({ ok: true })
      }),
    )

    await addPort(HOST, { pci: '0000:02:00.0', rxq: 2 })
    expect(hostId).toBe('local')
    expect(received).toEqual({ pci: '0000:02:00.0', rxq: 2 })
  })

  it('fetches stats scoped to the host and port', async () => {
    let path = ''
    const stats = makeStats({ pci: '0000:02:00.1', hw: { ...makeStats().hw, rx_packets: 1002 } })
    server.use(
      http.get('/api/hosts/:id/ports/:pci/stats', ({ params }) => {
        path = String(params.pci)
        return HttpResponse.json(stats)
      }),
    )

    await expect(getStats(HOST, '0000:02:00.1')).resolves.toEqual(stats)
    expect(path).toBe('0000:02:00.1')
  })

  it('percent-encodes the PCI address in the path', async () => {
    let path = ''
    server.use(
      http.post('/api/hosts/:id/ports/:pci/tx/start', ({ params }) => {
        path = String(params.pci)
        return HttpResponse.json({ ok: true })
      }),
    )

    await startTx(HOST, '0000:02:00.0', [
      {
        protocol: 'arp',
        src_mac: '00:11:22:33:44:55',
        dst_mac: 'ff:ff:ff:ff:ff:ff',
        src_ip: '10.0.0.1',
        dst_ip: '10.0.0.2',
      },
    ])
    expect(path).toBe('0000:02:00.0')
  })

  it('surfaces the backend error message', async () => {
    server.use(
      http.post('/api/hosts/:id/ports', () =>
        HttpResponse.json({ error: 'pci already added' }, { status: 400 }),
      ),
    )

    await expect(addPort(HOST, { pci: '0000:02:00.0' })).rejects.toMatchObject({
      message: 'pci already added',
      status: 400,
    })
    await expect(addPort(HOST, { pci: '0000:02:00.0' })).rejects.toBeInstanceOf(ApiError)
  })
})
