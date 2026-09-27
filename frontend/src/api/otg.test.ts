import { describe, expect, it } from 'vitest'
import { http, HttpResponse } from 'msw'
import { makeConfig, makePort, makePortMetric, server } from '../test/server.ts'
import { ApiError } from './client.ts'
import type { ControlState } from './types.ts'
import { getCapture, getConfig, getPortMetrics, setControlState, updateConfig } from './otg.ts'

const HOST = 'local'

describe('OTG API', () => {
  it('normalizes missing lists in GET /config', async () => {
    server.use(http.get('/api/hosts/:id/config', () => HttpResponse.json({ ports: [makePort()] })))

    await expect(getConfig(HOST)).resolves.toEqual(makeConfig({ ports: [makePort()] }))
  })

  it('posts the transformed config in a read-modify-write cycle', async () => {
    let posted: unknown
    server.use(
      http.get('/api/hosts/:id/config', () => HttpResponse.json(makeConfig())),
      http.post('/api/hosts/:id/config', async ({ request }) => {
        posted = await request.json()
        return HttpResponse.json({ warnings: ['w1'] })
      }),
    )

    const warnings = await updateConfig(HOST, (c) => ({ ...c, ports: [makePort()] }))
    expect(warnings).toEqual(['w1'])
    expect(posted).toEqual(makeConfig({ ports: [makePort()] }))
  })

  it('skips the POST when the transform changes nothing', async () => {
    let posted = false
    server.use(
      http.post('/api/hosts/:id/config', () => {
        posted = true
        return HttpResponse.json({ warnings: [] })
      }),
    )

    await expect(updateConfig(HOST, (c) => c)).resolves.toEqual([])
    expect(posted).toBe(false)
  })

  it('scopes control state to the host and posts the body verbatim', async () => {
    let hostId = ''
    let received: unknown
    server.use(
      http.post('/api/hosts/:id/control/state', async ({ request, params }) => {
        hostId = String(params.id)
        received = await request.json()
        return HttpResponse.json({ warnings: [] })
      }),
    )
    const state: ControlState = {
      choice: 'port',
      port: { choice: 'link', link: { port_names: ['p1'], state: 'down' } },
    }

    await setControlState('host-2', state)
    expect(hostId).toBe('host-2')
    expect(received).toEqual(state)
  })

  it('unwraps port metrics', async () => {
    const metric = makePortMetric({ frames_rx: 1002 })
    server.use(
      http.post('/api/hosts/:id/monitor/metrics', () =>
        HttpResponse.json({ choice: 'port_metrics', port_metrics: [metric] }),
      ),
    )

    await expect(getPortMetrics(HOST)).resolves.toEqual([metric])
  })

  it('fetches a capture as binary with the port name in the body', async () => {
    let received: unknown
    server.use(
      http.post('/api/hosts/:id/monitor/capture', async ({ request }) => {
        received = await request.json()
        return new HttpResponse(new Uint8Array([0x0a, 0x0d, 0x0d, 0x0a]), {
          headers: { 'Content-Type': 'application/octet-stream' },
        })
      }),
    )

    const blob = await getCapture(HOST, 'p1')
    expect(received).toEqual({ port_name: 'p1' })
    expect(blob.size).toBe(4)
  })

  it('surfaces the OTG error messages', async () => {
    server.use(
      http.post('/api/hosts/:id/control/state', () =>
        HttpResponse.json(
          { code: 400, kind: 'validation', errors: ['no such port "p9"', 'second'] },
          { status: 400 },
        ),
      ),
    )
    const call = () =>
      setControlState(HOST, {
        choice: 'port',
        port: { choice: 'capture', capture: { port_names: ['p9'], state: 'start' } },
      })

    await expect(call()).rejects.toMatchObject({
      message: 'no such port "p9"; second',
      status: 400,
    })
    await expect(call()).rejects.toBeInstanceOf(ApiError)
  })

  it('surfaces the backend error message', async () => {
    server.use(
      http.get('/api/hosts/:id/config', () =>
        HttpResponse.json({ error: 'unknown host: x' }, { status: 404 }),
      ),
    )

    await expect(getConfig('x')).rejects.toMatchObject({ message: 'unknown host: x', status: 404 })
  })
})
