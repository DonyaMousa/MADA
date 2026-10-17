import type { RequiredDocument, VaultDocument } from './types'

export type Readiness = {
  requirement: RequiredDocument
  status: 'present' | 'missing' | 'needs_review'
  note: string
}

export function documentReadiness(
  required: RequiredDocument[],
  attached: VaultDocument[],
): Readiness[] {
  return required.map((requirement) => {
    if (requirement.suggestedKind === 'letter') {
      return {
        requirement,
        status: 'needs_review' as const,
        note: 'Letters are drafted in Writing, not inferred as complete from a file name.',
      }
    }
    const match = attached.find((doc) => doc.kind === requirement.suggestedKind)
    if (!match) {
      return {
        requirement,
        status: 'missing' as const,
        note: 'No file of this kind is attached to this application.',
      }
    }
    return {
      requirement,
      status: 'present' as const,
      note: `${match.originalName} is attached. This does not certify that the file meets the provider’s standard.`,
    }
  })
}
