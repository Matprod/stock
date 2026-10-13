export const toCamel = (apiKey: string, prop?: string) => {
  const base = apiKey
    .split('_')
    .map((s, i) => (i ? s[0].toUpperCase() : s[0].toLowerCase()) + s.slice(1))
    .join('')
  return base + (prop ? prop[0].toUpperCase() + prop.slice(1) : '')
}
