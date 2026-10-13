import type { HttpContext } from '@adonisjs/core/http'

export class ReportV4AbortedError extends Error {
  constructor(message = 'Report generation cancelled') {
    super(message)
    this.name = 'ReportV4AbortedError'
  }
}

export const isReportV4AbortedError = (error: unknown): boolean =>
  error instanceof ReportV4AbortedError ||
  (typeof error === 'object' &&
    error !== null &&
    'name' in error &&
    (error as { name: unknown }).name === 'AbortError')

export const throwIfAborted = (signal?: AbortSignal): void => {
  if (!signal?.aborted) return
  throw new ReportV4AbortedError()
}

export const abortSignalFromHttp = (ctx: HttpContext): AbortSignal => {
  const ac = new AbortController()
  const req = ctx.request.request
  const res = ctx.response.response
  const abort = () => {
    if (!ac.signal.aborted) ac.abort()
  }
  if (req.aborted) {
    abort()
    return ac.signal
  }
  const onResponseClose = () => {
    if (!res.writableEnded && !res.writableFinished) abort()
  }
  req.once('aborted', abort)
  res.once('close', onResponseClose)
  ac.signal.addEventListener(
    'abort',
    () => {
      req.off('aborted', abort)
      res.off('close', onResponseClose)
    },
    { once: true }
  )
  return ac.signal
}
