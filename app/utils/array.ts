import { randomInt } from 'crypto'

export function shuffleArray<T>(array: T[]): void {
  for (let i = array.length - 1; i > 0; i--) {
    const j = randomInt(0, i + 1)
    const temp = array[i]
    array[i] = array[j]
    array[j] = temp
  }
}
