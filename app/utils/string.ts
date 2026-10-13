export function arrayToString<T>(array: T[]): string {
  return `[${array
    .map((item) => {
      if (typeof item === 'string') {
        return `"${item}"`
      }
      return item
    })
    .join(', ')}]`
}

export function capitalize(str: string): string {
  return str
    .toLowerCase()
    .split(/[_\s-]+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}
