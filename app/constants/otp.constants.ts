export const OTP_PURPOSE = {
  USER_FORGOT_PASSWORD: 'user_forgot_password',
  ATHLETE_FORGOT_PASSWORD: 'athlete_forgot_password',
} as const

export type OtpPurpose = (typeof OTP_PURPOSE)[keyof typeof OTP_PURPOSE]
