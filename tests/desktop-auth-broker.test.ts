import { describe, expect, it, vi } from 'vitest'
import { DesktopAuthCallbackBroker } from '../src/renderer/src/auth/desktopAuthPrimitives'

const state = 's'.repeat(43)
const url = (code = 'a'.repeat(32)) => `soravo://auth/callback?code=${code}&state=${state}`

describe('desktop callback broker', () => {
  it('waits for an in-flight outcome, retries explicit transient failures and retains completed fingerprints', async () => {
    const broker = new DesktopAuthCallbackBroker()
    let finish!: (outcome: 'retryable') => void
    const handler = vi.fn().mockImplementationOnce(() => new Promise(resolve => { finish = resolve })).mockResolvedValue('complete')
    broker.subscribe(handler)
    const first = broker.publish([url()])
    await vi.waitFor(() => expect(handler).toHaveBeenCalledTimes(1))
    const repeated = broker.publish([url()])
    expect(handler).toHaveBeenCalledTimes(1)
    finish('retryable')
    await Promise.all([first, repeated])
    expect(handler).toHaveBeenCalledTimes(2)
    await broker.publish([url()])
    expect(handler).toHaveBeenCalledTimes(2)
  })

  it('retains fingerprints when processing throws after a possible exchange', async () => {
    const broker = new DesktopAuthCallbackBroker()
    const handler = vi.fn().mockRejectedValue(new Error('local failure'))
    broker.subscribe(handler)
    await broker.publish([url(), url()])
    expect(handler).toHaveBeenCalledTimes(1)
    expect(broker.hasFailed()).toBe(true)
  })

  it('fails closed at its fingerprint limit without reopening earlier callbacks', async () => {
    const broker = new DesktopAuthCallbackBroker()
    const handler = vi.fn().mockResolvedValue('complete')
    broker.subscribe(handler)
    for (let i = 0; i < 1024; i += 8) {
      await broker.publish(Array.from({ length: 8 }, (_, j) => url((i + j).toString(36).padStart(32, '0'))))
    }
    await broker.publish([url('z'.repeat(32))])
    await broker.publish([url('0'.repeat(32))])
    expect(handler).toHaveBeenCalledTimes(1024)
    expect(broker.hasFailed()).toBe(true)
  })

  it('keeps queued callbacks across unsubscribe and allows redelivery after queue eviction', async () => {
    const broker = new DesktopAuthCallbackBroker()
    const first = url('a'.repeat(32))
    await broker.publish([first, ...'bcdefghi'.split('').map(c => url(c.repeat(32)))])
    await broker.publish([url('i'.repeat(32))])
    const oldHandler = vi.fn().mockResolvedValue('complete')
    const unsubscribe = broker.subscribe(oldHandler)
    unsubscribe()
    const handler = vi.fn().mockResolvedValue('complete')
    broker.subscribe(handler)
    await broker.publish([])
    expect(oldHandler).not.toHaveBeenCalled()
    expect(handler).toHaveBeenCalledTimes(8)
    await broker.publish([first])
    expect(handler).toHaveBeenCalledTimes(9)
  })
})
