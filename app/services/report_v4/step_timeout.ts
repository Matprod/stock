import { Exception } from '@adonisjs/core/exceptions'

export const withStepTimeout = async <T>(args: {
  step: string
  timeoutMs: number
  run: () => Promise<T>
}): Promise<T> => {
  if (!Number.isFinite(args.timeoutMs) || args.timeoutMs <= 0) return args.run()
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      args.run(),
      new Promise<T>((_resolve, reject) => {
        timer = setTimeout(() => {
          reject(
            new Exception(`Step ${args.step} exceeded ${Math.round(args.timeoutMs / 1000)}s`, {
              status: 504,
              code: 'E_REPORT_V4_STEP_TIMEOUT',
            })
          )
        }, args.timeoutMs)
      }),
    ])
  } finally {
    if (timer) clearTimeout(timer)
  }
}
