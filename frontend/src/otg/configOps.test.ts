import { describe, expect, it } from 'vitest'
import { makeConfig, makeFlow, makePort } from '../test/server.ts'
import { addPort, ConfigError, ensureCapture, removeFlow, removePort, saveFlow } from './configOps.ts'
import { formatLocation, parseLocation } from './location.ts'

const p1 = makePort({ name: 'p1', location: '0000:02:00.0?rxq=1&txq=1&rxd=1024' })
const p2 = makePort({ name: 'p2', location: '0000:02:00.1' })

describe('location', () => {
  it('formats the canonical form', () => {
    expect(formatLocation({ pci: '0000:02:00.0', rxq: 2, txq: 1, rxd: 2048 })).toBe(
      '0000:02:00.0?rxq=2&txq=1&rxd=2048',
    )
  })

  it('parses a bare PCI address with daemon defaults', () => {
    expect(parseLocation('0000:02:00.1')).toEqual({ pci: '0000:02:00.1', rxq: 1, txq: 1, rxd: 1024 })
  })

  it('parses a partial query', () => {
    expect(parseLocation('0000:02:00.1?rxd=4096')).toMatchObject({ rxq: 1, rxd: 4096 })
  })
})

describe('configOps', () => {
  it('adds a port', () => {
    expect(addPort(makeConfig({ ports: [p1] }), p2).ports).toEqual([p1, p2])
  })

  it('rejects a duplicate port name or PCI address', () => {
    const config = makeConfig({ ports: [p1] })
    expect(() => addPort(config, { ...p2, name: 'p1' })).toThrow(ConfigError)
    expect(() => addPort(config, { name: 'p9', location: '0000:02:00.0' })).toThrow(
      /already configured as port "p1"/,
    )
  })

  it('refuses to remove a port a flow still uses', () => {
    const config = makeConfig({ ports: [p1, p2], flows: [makeFlow()] })
    expect(() => removePort(config, 'p2')).toThrow(/used by flow\(s\) "f1"/)
  })

  it('drops a removed port from captures, removing emptied captures', () => {
    const config = makeConfig({
      ports: [p1, p2],
      captures: [
        { name: 'c1', port_names: ['p1'] },
        { name: 'c2', port_names: ['p1', 'p2'] },
      ],
    })
    const next = removePort(config, 'p1')
    expect(next.ports).toEqual([p2])
    expect(next.captures).toEqual([{ name: 'c2', port_names: ['p2'] }])
  })

  it('adds a capture only when none covers the port', () => {
    const covered = makeConfig({ ports: [p1], captures: [{ name: 'c', port_names: ['p1'] }] })
    expect(ensureCapture(covered, 'p1')).toBe(covered)

    const taken = makeConfig({ ports: [p1, p2], captures: [{ name: 'capture-p1', port_names: ['p2'] }] })
    expect(ensureCapture(taken, 'p1').captures[1]).toEqual({
      name: 'capture-p1-2',
      port_names: ['p1'],
      format: 'pcapng',
    })
  })

  it('adds, renames, and removes flows', () => {
    const added = saveFlow(makeConfig(), makeFlow())
    expect(added.flows.map((f) => f.name)).toEqual(['f1'])

    const renamed = saveFlow(added, makeFlow({ name: 'f2' }), 'f1')
    expect(renamed.flows.map((f) => f.name)).toEqual(['f2'])

    expect(removeFlow(renamed, 'f2').flows).toEqual([])
  })

  it('rejects a flow name clash', () => {
    const config = makeConfig({ flows: [makeFlow({ name: 'f1' }), makeFlow({ name: 'f2' })] })
    expect(() => saveFlow(config, makeFlow({ name: 'f1' }))).toThrow(/already exists/)
    expect(() => saveFlow(config, makeFlow({ name: 'f2' }), 'f1')).toThrow(/already exists/)
    expect(() => saveFlow(config, makeFlow({ name: 'f3' }), 'gone')).toThrow(/no longer exists/)
  })
})
