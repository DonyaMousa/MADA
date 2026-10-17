import type {
  CriterionResult,
  EligibilityResult,
  EligibilityRule,
  Profile,
  Scholarship,
} from './types'

function norm(value: string): string {
  return value.trim().toLowerCase()
}

function hasText(value: string | null | undefined): boolean {
  return Boolean(value && value.trim())
}

function nationalityPass(profile: Profile, rule: EligibilityRule): CriterionResult {
  const allowed = (rule.nationalities ?? []).map(norm)
  if (!allowed.length) {
    return {
      id: rule.id,
      label: rule.label,
      status: 'unknown',
      officialSource: rule.officialSource,
      explanation: 'This rule has no nationality list in the catalog record.',
    }
  }
  if (!hasText(profile.citizenship)) {
    return {
      id: rule.id,
      label: rule.label,
      status: 'unknown',
      officialSource: rule.officialSource,
      explanation: 'Citizenship is not on the profile, so this official nationality rule cannot be decided.',
    }
  }
  const ok = allowed.includes(norm(profile.citizenship))
  return {
    id: rule.id,
    label: rule.label,
    status: ok ? 'pass' : 'fail',
    officialSource: rule.officialSource,
    explanation: ok
      ? `Profile citizenship (${profile.citizenship}) is listed by the source.`
      : `Profile citizenship (${profile.citizenship}) is not in the source list (${rule.nationalities?.join(', ')}).`,
  }
}

function degreePass(profile: Profile, rule: EligibilityRule): CriterionResult {
  const allowed = rule.degrees ?? []
  if (!allowed.length) {
    return {
      id: rule.id,
      label: rule.label,
      status: 'unknown',
      officialSource: rule.officialSource,
      explanation: 'The catalog record does not name supported degrees for this rule.',
    }
  }
  if (!profile.intendedDegree) {
    return {
      id: rule.id,
      label: rule.label,
      status: 'unknown',
      officialSource: rule.officialSource,
      explanation: 'Intended degree is not on the profile.',
    }
  }
  if (profile.intendedDegree === 'either') {
    return {
      id: rule.id,
      label: rule.label,
      status: 'pass',
      officialSource: rule.officialSource,
      explanation: 'The profile is open to both Master’s and PhD study.',
    }
  }
  const ok = allowed.includes(profile.intendedDegree)
  return {
    id: rule.id,
    label: rule.label,
    status: ok ? 'pass' : 'fail',
    officialSource: rule.officialSource,
    explanation: ok
      ? `Intended ${profile.intendedDegree} is supported.`
      : `This listing supports ${allowed.join(' / ')}; the profile is aimed at ${profile.intendedDegree}.`,
  }
}

function fieldPass(profile: Profile, rule: EligibilityRule): CriterionResult {
  const fields = (rule.fields ?? []).map(norm)
  if (!fields.length) {
    return {
      id: rule.id,
      label: rule.label,
      status: 'unknown',
      officialSource: rule.officialSource,
      explanation: 'No field list is stored for this rule.',
    }
  }
  if (!hasText(profile.fieldOfStudy) && !hasText(profile.researchInterests)) {
    return {
      id: rule.id,
      label: rule.label,
      status: 'unknown',
      officialSource: rule.officialSource,
      explanation: 'Field of study is not on the profile.',
    }
  }
  const blob = `${profile.fieldOfStudy} ${profile.researchInterests}`.toLowerCase()
  const hit = fields.some((field) => blob.includes(field) || field.split(' ').every((part) => blob.includes(part)))
  if (hit) {
    return {
      id: rule.id,
      label: rule.label,
      status: 'pass',
      officialSource: rule.officialSource,
      explanation: 'Profile field or research interests overlap a named source field.',
    }
  }
  return {
    id: rule.id,
    label: rule.label,
    status: 'unknown',
    officialSource: rule.officialSource,
    explanation:
      'No exact field overlap was found. Mada does not infer that an unnamed field is ineligible.',
  }
}

function gpaPass(profile: Profile, rule: EligibilityRule): CriterionResult {
  if (rule.gpaMin == null || rule.gpaScale == null) {
    return {
      id: rule.id,
      label: rule.label,
      status: 'unknown',
      officialSource: rule.officialSource,
      explanation: 'GPA threshold is incomplete in the catalog record.',
    }
  }
  if (profile.gpa == null || profile.gpaScale == null) {
    return {
      id: rule.id,
      label: rule.label,
      status: 'unknown',
      officialSource: rule.officialSource,
      explanation: 'GPA or GPA scale is missing; Mada does not convert or invent a scale.',
    }
  }
  if (profile.gpaScale !== rule.gpaScale) {
    return {
      id: rule.id,
      label: rule.label,
      status: 'not_comparable',
      officialSource: rule.officialSource,
      explanation: `Source asks for ${rule.gpaMin}/${rule.gpaScale}; profile reports ${profile.gpa}/${profile.gpaScale}. Scales are not converted.`,
    }
  }
  const ok = profile.gpa >= rule.gpaMin
  return {
    id: rule.id,
    label: rule.label,
    status: ok ? 'pass' : 'fail',
    officialSource: rule.officialSource,
    explanation: ok
      ? `Reported GPA ${profile.gpa}/${profile.gpaScale} meets ${rule.gpaMin}/${rule.gpaScale}.`
      : `Reported GPA ${profile.gpa}/${profile.gpaScale} is below ${rule.gpaMin}/${rule.gpaScale}.`,
  }
}

function languagePass(profile: Profile, rule: EligibilityRule): CriterionResult {
  if (!rule.languageTest || rule.languageMin == null) {
    return {
      id: rule.id,
      label: rule.label,
      status: 'unknown',
      officialSource: rule.officialSource,
      explanation: 'Language rule is incomplete in the catalog record.',
    }
  }
  const match = profile.languageTests.find(
    (test) => norm(test.name) === norm(rule.languageTest ?? ''),
  )
  if (!match) {
    return {
      id: rule.id,
      label: rule.label,
      status: 'unknown',
      officialSource: rule.officialSource,
      explanation: `No ${rule.languageTest} score is on the profile. A different test is not treated as equivalent.`,
    }
  }
  const ok = match.score >= rule.languageMin
  return {
    id: rule.id,
    label: rule.label,
    status: ok ? 'pass' : 'fail',
    officialSource: rule.officialSource,
    explanation: ok
      ? `${match.name} ${match.score} meets the source minimum of ${rule.languageMin}.`
      : `${match.name} ${match.score} is below the source minimum of ${rule.languageMin}.`,
  }
}

function experiencePass(profile: Profile, rule: EligibilityRule): CriterionResult {
  const min = rule.experienceYearsMin
  if (min == null) {
    return {
      id: rule.id,
      label: rule.label,
      status: 'unknown',
      officialSource: rule.officialSource,
      explanation: 'Experience duration is not quantified in the catalog record.',
    }
  }
  if (profile.experienceYears == null) {
    return {
      id: rule.id,
      label: rule.label,
      status: 'unknown',
      officialSource: rule.officialSource,
      explanation: 'Years of experience are not on the profile and will not be inferred from free text.',
    }
  }
  const ok = profile.experienceYears >= min
  return {
    id: rule.id,
    label: rule.label,
    status: ok ? 'pass' : 'fail',
    officialSource: rule.officialSource,
    explanation: ok
      ? `Reported ${profile.experienceYears} year(s) meet the minimum of ${min}.`
      : `Reported ${profile.experienceYears} year(s) are below the minimum of ${min}.`,
  }
}

function otherPass(profile: Profile, rule: EligibilityRule): CriterionResult {
  void profile
  return {
    id: rule.id,
    label: rule.label,
    status: 'unknown',
    officialSource: rule.officialSource,
    explanation: rule.notes ?? 'This requirement must be checked on the official source; it is not auto-decided.',
  }
}

function evaluateRule(profile: Profile, rule: EligibilityRule): CriterionResult {
  switch (rule.kind) {
    case 'nationality':
      return nationalityPass(profile, rule)
    case 'degree':
      return degreePass(profile, rule)
    case 'field':
      return fieldPass(profile, rule)
    case 'gpa':
      return gpaPass(profile, rule)
    case 'language':
      return languagePass(profile, rule)
    case 'experience':
      return experiencePass(profile, rule)
    default:
      return otherPass(profile, rule)
  }
}

export function evaluateEligibility(profile: Profile, scholarship: Scholarship): EligibilityResult {
  const criteria = scholarship.eligibilityRules.map((rule) => evaluateRule(profile, rule))
  if (!criteria.length) {
    return { outcome: 'insufficient_information', criteria }
  }
  if (criteria.some((item) => item.status === 'fail')) {
    return { outcome: 'ineligible', criteria }
  }
  const decided = criteria.filter((item) => item.status === 'pass' || item.status === 'fail')
  const undecided = criteria.filter(
    (item) => item.status === 'unknown' || item.status === 'not_comparable',
  )
  if (!decided.length) {
    return { outcome: 'insufficient_information', criteria }
  }
  if (undecided.length) {
    return { outcome: 'possibly_eligible', criteria }
  }
  return { outcome: 'eligible', criteria }
}
