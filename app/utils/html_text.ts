export const escapeHtml = (value: string): string =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

export const foldKey = (value: string): string => value.toLowerCase().replace(/\s+/g, ' ').trim()

export const foldAscii = (value: string): string =>
  value.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '')
