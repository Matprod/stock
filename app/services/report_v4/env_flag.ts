export const envFlag = (name: string, defaultValue: boolean): boolean => {
  const raw = process.env[name]?.trim().toLowerCase()
  if (raw === '0' || raw === 'false' || raw === 'off') return false
  if (raw === '1' || raw === 'true' || raw === 'on') return true
  return defaultValue
}
