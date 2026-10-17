export type CvSuggestion = {
  field: string
  value: string
  sourceText: string
  confidence: number
}

export function extractCvSuggestions(text: string): CvSuggestion[] {
  const suggestions: CvSuggestion[] = []
  const gpa = text.match(/GPA[:\s]+([0-9]+(?:\.[0-9]+)?)\s*\/\s*([0-9]+(?:\.[0-9]+)?)/i)
  if (gpa) {
    suggestions.push({
      field: 'gpa',
      value: gpa[1],
      sourceText: gpa[0],
      confidence: 0.72,
    })
    suggestions.push({
      field: 'gpaScale',
      value: gpa[2],
      sourceText: gpa[0],
      confidence: 0.72,
    })
  }
  const degree = text.match(/\b(BSc|BA|MSc|MA|MEng|PhD|Bachelor|Master)\b[^\n]{0,60}/i)
  if (degree) {
    suggestions.push({
      field: 'currentDegree',
      value: degree[0].trim(),
      sourceText: degree[0].trim(),
      confidence: 0.55,
    })
  }
  const uni = text.match(
    /\b(University|Universit[eé]|Institute|College)\b[^\n]{0,80}/i,
  )
  if (uni) {
    suggestions.push({
      field: 'institution',
      value: uni[0].trim(),
      sourceText: uni[0].trim(),
      confidence: 0.48,
    })
  }
  const ielts = text.match(/IELTS[:\s]+([0-9](?:\.[0-9])?)/i)
  if (ielts) {
    suggestions.push({
      field: 'languageTests',
      value: JSON.stringify({ name: 'IELTS', score: Number(ielts[1]) }),
      sourceText: ielts[0],
      confidence: 0.7,
    })
  }
  return suggestions
}

export function localSopReview(text: string, requirementSummary: string): {
  provider: 'local_rules'
  bullets: string[]
} {
  const bullets: string[] = []
  const words = text.trim().split(/\s+/).filter(Boolean)
  if (words.length < 250) bullets.push('The draft is short. Many master’s/PhD statements need more evidence than this length.')
  if (!/I |my |we /i.test(text)) bullets.push('The draft rarely uses first person. Keep your own voice; do not sound like a brochure.')
  const reqWords = requirementSummary.toLowerCase().split(/\W+/).filter((w) => w.length > 5)
  const missing = reqWords.filter((w) => !text.toLowerCase().includes(w)).slice(0, 6)
  if (missing.length) {
    bullets.push(`These words from the verified listing are weakly reflected: ${missing.join(', ')}.`)
  }
  if (!/because|evidence|project|research|thesis|supervised/i.test(text)) {
    bullets.push('Add concrete evidence (a project, paper, or supervised task) rather than general ambition.')
  }
  bullets.push('These notes are local writing checks, not an AI model review.')
  return { provider: 'local_rules', bullets }
}
