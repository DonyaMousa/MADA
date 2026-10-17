import { evaluateEligibility } from './eligibility'
import type { MatchResult, Profile, Scholarship } from './types'

const STOP = new Set([
  'the', 'and', 'for', 'with', 'that', 'this', 'from', 'your', 'are', 'was', 'were',
  'to', 'of', 'in', 'on', 'a', 'an', 'or', 'as', 'by', 'at', 'be', 'is',
])

function tokens(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9\u0600-\u06ff]+/)
    .filter((token) => token.length > 2 && !STOP.has(token))
}

/** Hashed bag-of-tokens vector. Not trained on private student files. */
export function embed(text: string, dimensions = 128): number[] {
  const vector = Array.from({ length: dimensions }, () => 0)
  const all = tokens(text)
  const grams = [...all]
  for (let i = 0; i < all.length - 1; i += 1) grams.push(`${all[i]}_${all[i + 1]}`)
  for (const gram of grams) {
    let hash = 2166136261
    for (let i = 0; i < gram.length; i += 1) {
      hash ^= gram.charCodeAt(i)
      hash = Math.imul(hash, 16777619)
    }
    const index = Math.abs(hash) % dimensions
    vector[index] += 1
  }
  const norm = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0)) || 1
  return vector.map((value) => value / norm)
}

export function cosine(a: number[], b: number[]): number {
  let sum = 0
  for (let i = 0; i < Math.min(a.length, b.length); i += 1) sum += a[i] * b[i]
  return sum
}

function structuredScore(profile: Profile, scholarship: Scholarship): number {
  let points = 0
  let max = 0

  max += 1
  if (profile.intendedDegree === 'either') points += 1
  else if (
    profile.intendedDegree &&
    scholarship.supportedDegrees.includes(profile.intendedDegree)
  ) {
    points += 1
  }

  max += 1
  if (profile.destinationPreferences.length === 0) points += 0.4
  else if (
    profile.destinationPreferences.some((country) =>
      scholarship.destinationCountries.map((item) => item.toLowerCase()).includes(country.toLowerCase()),
    )
  ) {
    points += 1
  }

  max += 1
  if (!profile.fundingNeed || profile.fundingNeed === 'any') points += 0.6
  else if (profile.fundingNeed === 'partial') points += scholarship.fundingType !== 'unknown' ? 0.8 : 0.4
  else if (profile.fundingNeed === 'full') points += scholarship.fundingType === 'full' ? 1 : 0.2

  max += 1
  const fieldBlob = `${profile.fieldOfStudy} ${profile.researchInterests}`.toLowerCase()
  if (!fieldBlob.trim()) points += 0.3
  else if (scholarship.fields.some((field) => fieldBlob.includes(field.toLowerCase()))) points += 1
  else points += 0.2

  return max === 0 ? 0 : points / max
}

export function rankScholarship(profile: Profile, scholarship: Scholarship): MatchResult {
  const eligibility = evaluateEligibility(profile, scholarship)
  const unmet = eligibility.criteria
    .filter((item) => item.status === 'fail')
    .map((item) => item.explanation)
  const missing = eligibility.criteria
    .filter((item) => item.status === 'unknown' || item.status === 'not_comparable')
    .map((item) => item.explanation)
  const strengths = eligibility.criteria
    .filter((item) => item.status === 'pass')
    .map((item) => item.explanation)

  if (eligibility.outcome === 'ineligible') {
    return {
      scholarship,
      eligibility,
      suitability: null,
      why: ['Hard eligibility failed. Suitability is not shown as an acceptance signal.'],
      strengths,
      missing,
      unmet,
    }
  }

  const structured = structuredScore(profile, scholarship)
  const profileText = [
    profile.fieldOfStudy,
    profile.researchInterests,
    profile.relevantExperience,
    profile.currentDegree,
  ].join(' ')
  const listingText = [
    scholarship.title,
    scholarship.fields.join(' '),
    scholarship.eligibilitySummary,
    scholarship.bodyText,
  ].join(' ')
  const semantic = cosine(embed(profileText), embed(listingText))
  const suitability = Math.round((0.6 * structured + 0.4 * Math.max(0, semantic)) * 100)

  const why = [
    `Structured preferences contributed 60% and local text similarity 40% (see docs/MATCHING.md).`,
    `Suitability ${suitability}/100 is alignment with known requirements and preferences, not an acceptance probability.`,
  ]
  if (profile.destinationPreferences.length) {
    why.push(`Destination preferences: ${profile.destinationPreferences.join(', ')}.`)
  }

  return { scholarship, eligibility, suitability, why, strengths, missing, unmet }
}

export function rankScholarships(profile: Profile, scholarships: Scholarship[]): MatchResult[] {
  return scholarships
    .map((scholarship) => rankScholarship(profile, scholarship))
    .sort((a, b) => {
      const order = {
        eligible: 0,
        possibly_eligible: 1,
        insufficient_information: 2,
        ineligible: 3,
      } as const
      const byOutcome = order[a.eligibility.outcome] - order[b.eligibility.outcome]
      if (byOutcome !== 0) return byOutcome
      return (b.suitability ?? -1) - (a.suitability ?? -1)
    })
}
