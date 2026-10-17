import type { Profile } from './types'

const FIELDS: Array<{ key: keyof Profile; weight: number }> = [
  { key: 'citizenship', weight: 1 },
  { key: 'residenceCountry', weight: 1 },
  { key: 'currentDegree', weight: 1 },
  { key: 'institution', weight: 1 },
  { key: 'fieldOfStudy', weight: 1 },
  { key: 'gpa', weight: 1 },
  { key: 'gpaScale', weight: 1 },
  { key: 'graduationYear', weight: 1 },
  { key: 'intendedDegree', weight: 1 },
  { key: 'researchInterests', weight: 1 },
  { key: 'destinationPreferences', weight: 1 },
  { key: 'fundingNeed', weight: 1 },
  { key: 'languageTests', weight: 1 },
  { key: 'relevantExperience', weight: 1 },
]

export function profileCompleteness(profile: Profile): { percent: number; filled: number; total: number } {
  let filled = 0
  for (const field of FIELDS) {
    const value = profile[field.key]
    if (Array.isArray(value)) {
      if (value.length) filled += 1
    } else if (typeof value === 'number') {
      filled += 1
    } else if (typeof value === 'string' && value.trim()) {
      filled += 1
    }
  }
  const total = FIELDS.length
  return { percent: Math.round((filled / total) * 100), filled, total }
}

export function emptyProfile(id: string, email: string): Profile {
  return {
    id,
    email,
    displayName: '',
    citizenship: '',
    residenceCountry: '',
    currentDegree: '',
    institution: '',
    fieldOfStudy: '',
    gpa: null,
    gpaScale: null,
    graduationYear: null,
    intendedDegree: '',
    researchInterests: '',
    destinationPreferences: [],
    fundingNeed: '',
    languageTests: [],
    relevantExperience: '',
    workExperience: '',
    experienceYears: null,
    locale: 'en',
    timezone: 'Africa/Cairo',
    role: 'student',
    createdAt: new Date().toISOString(),
  }
}
