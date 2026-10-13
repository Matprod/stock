import { escapeHtml } from '#utils/html_text'

export { escapeHtml }

export const attr = (name: string, value: string | number | boolean | null | undefined): string => {
  if (value === null || value === undefined || value === false) return ''
  if (value === true) return ` ${name}`
  return ` ${name}="${escapeHtml(String(value))}"`
}

export const styleAttr = (rules: Record<string, string | number | undefined | null>): string => {
  const parts: string[] = []
  for (const [key, value] of Object.entries(rules)) {
    if (value === null || value === undefined || value === '') continue
    parts.push(`${key}:${value}`)
  }
  return parts.length ? attr('style', parts.join(';')) : ''
}
