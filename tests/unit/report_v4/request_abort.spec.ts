import { test } from '@japa/runner'
import {
  isReportV4AbortedError,
  ReportV4AbortedError,
  throwIfAborted,
} from '#services/report_v4/request_abort'

test.group('report_v4 request abort', () => {
  test('throwIfAborted is no-op when signal is missing or open', ({ assert }) => {
    assert.doesNotThrow(() => throwIfAborted())
    assert.doesNotThrow(() => throwIfAborted(new AbortController().signal))
  })

  test('throwIfAborted raises ReportV4AbortedError when aborted', ({ assert }) => {
    const ac = new AbortController()
    ac.abort()
    assert.throws(() => throwIfAborted(ac.signal), ReportV4AbortedError)
  })

  test('isReportV4AbortedError detects AbortError name', ({ assert }) => {
    const err = new Error('cancelled')
    err.name = 'AbortError'
    assert.isTrue(isReportV4AbortedError(err))
    assert.isTrue(isReportV4AbortedError(new ReportV4AbortedError()))
    assert.isFalse(isReportV4AbortedError(new Error('boom')))
  })

  test('abortSignalFromHttp does not treat finished request body as cancel', async ({
    assert,
  }) => {
    const { EventEmitter } = await import('node:events')
    const { abortSignalFromHttp } = await import('#services/report_v4/request_abort')

    type Emitter = InstanceType<typeof EventEmitter>
    const req = new EventEmitter() as Emitter & {
      aborted: boolean
      destroyed: boolean
    }
    req.aborted = false
    req.destroyed = true

    const res = new EventEmitter() as Emitter & {
      writableEnded: boolean
      writableFinished: boolean
    }
    res.writableEnded = false
    res.writableFinished = false

    const ctx = {
      request: { request: req },
      response: { response: res },
    } as never

    const signal = abortSignalFromHttp(ctx)
    req.emit('close')
    await new Promise((resolve) => setImmediate(resolve))
    assert.isFalse(signal.aborted)

    res.emit('close')
    assert.isTrue(signal.aborted)
  })
})
