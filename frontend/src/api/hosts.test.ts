import { describe, expect, it } from 'vitest'
import { http, HttpResponse } from 'msw'
import { server, makeHost } from '../test/server.ts'
import { ApiError } from './client.ts'
import { addHost, listHosts, removeHost } from './hosts.ts'

describe('hosts API', () => {
  it('unwraps the hosts array from GET /api/hosts', async () => {
    await expect(listHosts()).resolves.toEqual([makeHost()])
  })

  it('POSTs a new host and returns it', async () => {
    let received: unknown
    const created = makeHost({ id: 'host-1', label: 'rack-2', address: 'http://10.0.0.2:7878' })
    server.use(
      http.post('/api/hosts', async ({ request }) => {
        received = await request.json()
        return HttpResponse.json(created, { status: 201 })
      }),
    )

    await expect(addHost({ label: 'rack-2', address: 'http://10.0.0.2:7878' })).resolves.toEqual(
      created,
    )
    expect(received).toEqual({ label: 'rack-2', address: 'http://10.0.0.2:7878' })
  })

  it('DELETEs a host and resolves on 204', async () => {
    let deletedId = ''
    server.use(
      http.delete('/api/hosts/:id', ({ params }) => {
        deletedId = String(params.id)
        return new HttpResponse(null, { status: 204 })
      }),
    )

    await expect(removeHost('host-1')).resolves.toBeUndefined()
    expect(deletedId).toBe('host-1')
  })

  it('surfaces the backend error message', async () => {
    server.use(
      http.delete('/api/hosts/:id', () =>
        HttpResponse.json({ error: 'cannot remove' }, { status: 400 }),
      ),
    )

    await expect(removeHost('local')).rejects.toMatchObject({
      message: 'cannot remove',
      status: 400,
    })
    await expect(removeHost('local')).rejects.toBeInstanceOf(ApiError)
  })
})
