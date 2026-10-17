import type { AssistantMessage, Scholarship, VaultDocument } from './types'

export type RetrievalRequest = {
  scholarshipId: string
  applicationId: string | null
  includeAttachments: boolean
  question: string
  allowedDocumentIds: string[]
}

function passagesFromScholarship(scholarship: Scholarship): Array<{
  label: string
  passage: string
  kind: 'official'
}> {
  return [
    {
      label: 'Official source',
      passage: scholarship.eligibilitySummary,
      kind: 'official',
    },
    {
      label: 'Covered costs',
      passage: scholarship.coveredCosts.join('; ') || 'Not listed in the catalog record.',
      kind: 'official',
    },
    ...scholarship.eligibilityRules.map((rule) => ({
      label: rule.label,
      passage: `${rule.label}. Source: ${rule.officialSource}`,
      kind: 'official' as const,
    })),
  ]
}

export function answerScholarshipQuestion(input: {
  request: RetrievalRequest
  scholarship: Scholarship | null
  documents: VaultDocument[]
}): { content: string; citations: AssistantMessage['citations']; unknown: boolean } {
  const { request, scholarship, documents } = input
  if (!scholarship || scholarship.id !== request.scholarshipId) {
    return {
      content: 'This assistant only answers for the selected scholarship. The listing was not found.',
      citations: [],
      unknown: true,
    }
  }

  const official = passagesFromScholarship(scholarship)
  const allowedDocs = request.includeAttachments
    ? documents.filter((doc) => request.allowedDocumentIds.includes(doc.id))
    : []

  const q = request.question.toLowerCase()
  const hits = official.filter(
    (item) =>
      item.passage.toLowerCase().split(' ').some((word) => word.length > 4 && q.includes(word.slice(0, 8))) ||
      q.includes('eligib') ||
      q.includes('deadline') ||
      q.includes('document') ||
      q.includes('fund'),
  )

  const citations: AssistantMessage['citations'] = []
  if (q.includes('deadline')) {
    citations.push({
      label: 'Deadline in catalog',
      passage: scholarship.deadlineAt
        ? `${scholarship.deadlineAt} (${scholarship.deadlineTimezone ?? 'timezone not supplied'}; certainty: ${scholarship.deadlineCertainty})`
        : 'Deadline is unknown in the catalog. Check the official source.',
      kind: 'official',
    })
  }
  if (q.includes('eligib') || q.includes('national') || q.includes('egypt')) {
    for (const rule of scholarship.eligibilityRules) {
      citations.push({
        label: rule.label,
        passage: `${rule.label} — ${rule.officialSource}`,
        kind: 'official',
      })
    }
  }
  if (q.includes('document') || q.includes('cv') || q.includes('transcript')) {
    for (const doc of scholarship.requiredDocuments) {
      citations.push({
        label: doc.label,
        passage: `${doc.label} — ${doc.officialSource}`,
        kind: 'official',
      })
    }
  }
  if (citations.length === 0) {
    citations.push(...hits.slice(0, 3))
  }

  if (request.includeAttachments) {
    for (const doc of allowedDocs) {
      if (doc.extractedText && q.split(' ').some((word) => doc.extractedText.toLowerCase().includes(word))) {
        citations.push({
          label: `Attached file: ${doc.originalName}`,
          passage: doc.extractedText.slice(0, 280),
          kind: 'document',
        })
      }
    }
  }

  if (!citations.length) {
    return {
      content:
        'Unknown from the verified catalog record. Peer community answers are not official requirements. See the official source.',
      citations: [
        {
          label: 'Official source',
          passage: scholarship.officialSourceUrl,
          kind: 'official',
        },
      ],
      unknown: true,
    }
  }

  const officialBits = citations.filter((item) => item.kind === 'official').map((item) => item.passage)
  const suggestion = 'This is a navigation aid, not a substitute for the provider’s rules.'
  return {
    content: `${officialBits.join('\n\n')}\n\n${suggestion}`,
    citations: [
      ...citations,
      { label: 'Suggestion', passage: suggestion, kind: 'suggestion' },
    ],
    unknown: false,
  }
}

export function assertRetrievalBoundary(input: {
  conversationScholarshipId: string
  requestedScholarshipId: string
  conversationApplicationId: string | null
  requestedApplicationId: string | null
}): { ok: true } | { ok: false; error: string } {
  if (input.conversationScholarshipId !== input.requestedScholarshipId) {
    return { ok: false, error: 'Private retrieval cannot cross scholarships.' }
  }
  if (
    input.requestedApplicationId &&
    input.conversationApplicationId &&
    input.conversationApplicationId !== input.requestedApplicationId
  ) {
    return { ok: false, error: 'Private retrieval cannot cross applications.' }
  }
  return { ok: true }
}
