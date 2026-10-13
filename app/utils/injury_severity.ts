import { DateTime } from 'luxon'
import type { InjurySeverity } from '#contracts/sunderland'

export function calculateInjuryDuration(
  dateOfInjury: DateTime,
  recoveryDate: DateTime | null,
  currentDate: DateTime
): number {
  if (!dateOfInjury) {
    return 0
  }

  const endDate = recoveryDate || currentDate
  const duration = endDate.diff(dateOfInjury, 'days').days

  return Math.max(0, Math.round(duration))
}

export function classifyInjurySeverity(
  pathology: string | null,
  durationDays: number
): InjurySeverity {
  if (!pathology) {
    if (durationDays < 10) {
      return 'light'
    } else if (durationDays < 30) {
      return 'medium'
    } else if (durationDays < 120) {
      return 'serious'
    } else {
      return 'very_serious'
    }
  }

  const pathologyLower = pathology.toLowerCase().trim()

  const verySeriousPathologies = [
    'fracture',
    'bone stress injury',
    'nerve injury',
    'tendon rupture',
    'physis injury',
    'organ trauma',
    'cartilage',
  ]

  if (verySeriousPathologies.some((p) => pathologyLower.includes(p))) {
    if (durationDays < 30) {
      return 'serious'
    } else if (durationDays < 60) {
      return 'very_serious'
    } else {
      return 'very_serious'
    }
  }

  const seriousPathologies = [
    'muscle injury',
    'joint sprain',
    'ligament',
    'tendinopathy',
    'chronic instability',
    'arthritis',
  ]

  if (seriousPathologies.some((p) => pathologyLower.includes(p))) {
    if (durationDays < 7) {
      return 'medium'
    } else if (durationDays < 30) {
      return 'serious'
    } else if (durationDays < 60) {
      return 'serious'
    } else {
      return 'very_serious'
    }
  }

  const mediumPathologies = [
    'muscle contusion',
    'bone contusion',
    'synovitis',
    'capsulitis',
    'contusion',
    'vascular',
    'laceration',
  ]

  if (mediumPathologies.some((p) => pathologyLower.includes(p))) {
    if (durationDays < 3) {
      return 'light'
    } else if (durationDays < 14) {
      return 'medium'
    } else if (durationDays < 30) {
      return 'medium'
    } else if (durationDays < 60) {
      return 'serious'
    } else {
      return 'very_serious'
    }
  }

  const lightPathologies = ['abrasion', 'pain without tissue type specified']

  if (lightPathologies.some((p) => pathologyLower.includes(p))) {
    if (durationDays < 7) {
      return 'light'
    } else if (durationDays < 14) {
      return 'light'
    } else if (durationDays < 30) {
      return 'medium'
    } else {
      return 'serious'
    }
  }

  if (durationDays < 10) {
    return 'light'
  } else if (durationDays < 30) {
    return 'medium'
  } else if (durationDays < 120) {
    return 'serious'
  } else {
    return 'very_serious'
  }
}
