import type { FundingType, NlConstraints, OpenStatus, Scholarship } from './types'

const COUNTRIES: Record<string, string> = {
  germany: 'Germany',
  german: 'Germany',
  uk: 'United Kingdom',
  'united kingdom': 'United Kingdom',
  britain: 'United Kingdom',
  england: 'United Kingdom',
  france: 'France',
  french: 'France',
  usa: 'United States',
  us: 'United States',
  america: 'United States',
  canada: 'Canada',
  switzerland: 'Switzerland',
  netherlands: 'Netherlands',
  sweden: 'Sweden',
  australia: 'Australia',
  egypt: 'Egypt',
}

const FIELDS = [
  'computer science',
  'engineering',
  'public policy',
  'law',
  'medicine',
  'biology',
  'chemistry',
  'physics',
  'economics',
  'business',
  'education',
  'architecture',
  'arts',
  'social science',
  'data science',
  'climate',
  'energy',
]

export function interpretQuery(query: string): NlConstraints {
  const q = query.toLowerCase()
  const degrees: Array<'masters' | 'phd'> = []
  if (/\b(phd|ph\.d|doctorate|doctoral)\b/.test(q)) degrees.push('phd')
  if (/\b(master'?s|msc|ma\b|graduate taught)\b/.test(q)) degrees.push('masters')

  const countries = Object.entries(COUNTRIES)
    .filter(([key]) => q.includes(key))
    .map(([, name]) => name)
    .filter((name, index, all) => all.indexOf(name) === index)

  const fields = FIELDS.filter((field) => q.includes(field))

  let funding: FundingType | '' = ''
  if (/fully funded|full funding|full ride/.test(q)) funding = 'full'
  else if (/partial/.test(q)) funding = 'partial'

  let openStatus: OpenStatus | '' = ''
  if (/\bopen\b/.test(q)) openStatus = 'open'
  else if (/\bclosed\b/.test(q)) openStatus = 'closed'

  const nationality = /egyptian|egypt/.test(q) ? 'Egypt' : ''

  return {
    query,
    degrees,
    countries,
    fields,
    funding,
    openStatus,
    nationality,
    interpreter: 'local_rules',
  }
}

export function applyNlConstraints(
  scholarships: Scholarship[],
  constraints: NlConstraints,
): Scholarship[] {
  return scholarships.filter((item) => {
    if (constraints.degrees.length && !constraints.degrees.some((d) => item.supportedDegrees.includes(d))) {
      return false
    }
    if (
      constraints.countries.length &&
      !constraints.countries.some((country) =>
        item.destinationCountries.some((d) => d.toLowerCase() === country.toLowerCase()),
      )
    ) {
      return false
    }
    if (
      constraints.fields.length &&
      !constraints.fields.some((field) =>
        `${item.title} ${item.fields.join(' ')} ${item.bodyText}`.toLowerCase().includes(field),
      )
    ) {
      return false
    }
    if (constraints.funding && constraints.funding !== 'any' && item.fundingType !== constraints.funding) {
      return false
    }
    if (constraints.openStatus && item.openStatus !== constraints.openStatus) {
      return false
    }
    return true
  })
}
