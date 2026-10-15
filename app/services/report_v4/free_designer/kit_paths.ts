import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))

export const DESIGN_KIT_ROOT = join(HERE, '..', 'design_kit')

export const designKitPath = (...parts: string[]) => join(DESIGN_KIT_ROOT, ...parts)
