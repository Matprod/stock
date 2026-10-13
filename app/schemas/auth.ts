import vine from '@vinejs/vine'
import { normalizeEmail } from '#utils/email'

const emailRule = vine
  .string()
  .trim()
  .email()
  .transform((value) => normalizeEmail(value))

const newPasswordRule = vine
  .string()
  .trim()
  .minLength(8)
  .regex(/\d/)
  .regex(/[^A-Za-z0-9]/)

export const loginSchema = vine.compile(
  vine.object({
    email: emailRule.clone(),
    password: vine.string().trim(),
  })
)

export const sendForgotPasswordOtpSchema = vine.compile(
  vine.object({
    email: emailRule.clone(),
  })
)

export const verifyForgotPasswordOtpSchema = vine.compile(
  vine.object({
    idx: vine.string().trim().uuid(),
    code: vine.string().trim().fixedLength(4),
  })
)

export const resetPasswordSchema = vine.compile(
  vine.object({
    email: emailRule.clone(),
    newPassword: newPasswordRule,
    idx: vine.string().trim().uuid(),
    code: vine.string().trim().fixedLength(4),
  })
)
