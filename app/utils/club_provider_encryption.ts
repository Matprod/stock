import encryption from '@adonisjs/core/services/encryption'

const isPlaintextJwt = (value: string): boolean => value.startsWith('eyJ')

const isEncryptedPayload = (value: string): boolean => encryption.decrypt(value) !== null

const encryptClubProviderSecret = (value: string | null): string | null => {
  if (value === null || value === '') {
    return null
  }

  if (isEncryptedPayload(value)) {
    return value
  }

  return encryption.encrypt(value) as string
}

const decryptClubProviderSecret = (value: string | null): string | null => {
  if (value === null || value === '') {
    return null
  }

  const decrypted = encryption.decrypt(value)
  if (decrypted !== null) {
    return typeof decrypted === 'string' ? decrypted : String(decrypted)
  }

  if (isPlaintextJwt(value)) {
    return value
  }

  throw new Error(
    'Unable to decrypt club provider secret. The value may be truncated (use TEXT columns), encrypted with another APP_KEY, or corrupted. Re-save the token in admin.'
  )
}

export const clubProviderSecretColumnOptions = {
  prepare: (value: string | null) => encryptClubProviderSecret(value),
  consume: (value: string | null) => decryptClubProviderSecret(value),
}
