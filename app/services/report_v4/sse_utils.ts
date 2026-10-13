import { PassThrough } from 'node:stream'
import type { HttpContext } from '@adonisjs/core/http'

const sseFrame = (data: unknown, event?: string): string =>
  `${event ? `event: ${event}\n` : ''}data: ${JSON.stringify(data)}\n\n`

export const sanitizeDownloadFilename = (filename: string): string =>
  filename.replace(/["\\\r\n]/g, '_')

export class SseStreamHandler {
  private constructor(private readonly stream: PassThrough) {}

  static open(ctx: HttpContext): SseStreamHandler {
    const stream = new PassThrough()
    const handler = new SseStreamHandler(stream)
    handler.applyHeaders(ctx)
    stream.pipe(ctx.response.response)
    return handler
  }

  private applyHeaders(ctx: HttpContext): void {
    const nodeRes = ctx.response.response
    const origin = ctx.request.header('origin')
    if (origin) {
      nodeRes.setHeader('Access-Control-Allow-Origin', origin)
      nodeRes.setHeader('Access-Control-Allow-Credentials', 'true')
    }
    ctx.response.header('Content-Type', 'text/event-stream')
    ctx.response.header('Cache-Control', 'no-cache')
    ctx.response.header('Connection', 'keep-alive')
    nodeRes.setHeader('Content-Type', 'text/event-stream; charset=utf-8')
    nodeRes.setHeader('Cache-Control', 'no-cache')
    nodeRes.setHeader('Connection', 'keep-alive')
    nodeRes.setHeader('X-Accel-Buffering', 'no')
    nodeRes.flushHeaders()
  }

  sendEvent(data: unknown, event?: string): void {
    if (this.stream.destroyed || this.stream.writableEnded) return
    this.stream.write(sseFrame(data, event))
  }

  close(): void {
    if (!this.stream.destroyed && !this.stream.writableEnded) this.stream.end()
  }
}
