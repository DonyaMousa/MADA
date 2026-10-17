export type Locale = 'en' | 'ar'
export type Theme = 'dark' | 'light'
export type Degree = 'masters' | 'phd' | 'either'
export type FundingType = 'full' | 'partial' | 'unknown' | 'any'
export type OpenStatus = 'open' | 'closed' | 'unknown'
export type VerificationState = 'draft' | 'in_review' | 'verified' | 'needs_review' | 'archived'
export type WorkspaceStatus =
  | 'saved'
  | 'preparing'
  | 'submitted'
  | 'shortlisted'
  | 'accepted'
  | 'rejected'
  | 'withdrawn'
export type DocumentKind =
  | 'cv'
  | 'transcript'
  | 'certificate'
  | 'language_result'
  | 'recommendation'
  | 'other'
export type CommunityChannel = 'general' | 'eligibility' | 'documents_essays' | 'deadlines' | 'tips'
export type EligibilityOutcome =
  | 'eligible'
  | 'possibly_eligible'
  | 'ineligible'
  | 'insufficient_information'
export type CriterionStatus = 'pass' | 'fail' | 'unknown' | 'not_comparable'

export type LanguageTest = {
  name: string
  score: number
  max?: number
}

export type EligibilityRule = {
  id: string
  kind: 'nationality' | 'degree' | 'field' | 'gpa' | 'language' | 'experience' | 'other'
  label: string
  officialSource: string
  nationalities?: string[]
  degrees?: Array<'masters' | 'phd'>
  fields?: string[]
  gpaMin?: number
  gpaScale?: number
  languageTest?: string
  languageMin?: number
  experienceYearsMin?: number
  notes?: string
}

export type RequiredDocument = {
  id: string
  label: string
  officialSource: string
  suggestedKind: DocumentKind | 'letter'
}

export type Scholarship = {
  id: string
  slug: string
  title: string
  provider: string
  destinationCountries: string[]
  supportedDegrees: Array<'masters' | 'phd'>
  fields: string[]
  fundingType: Exclude<FundingType, 'any'>
  coveredCosts: string[]
  deadlineAt: string | null
  deadlineTimezone: string | null
  deadlineCertainty: 'confirmed' | 'typical_cycle' | 'unknown'
  openStatus: OpenStatus
  eligibilitySummary: string
  eligibilityRules: EligibilityRule[]
  requiredDocuments: RequiredDocument[]
  officialApplicationUrl: string
  officialSourceUrl: string
  lastVerifiedAt: string | null
  verificationState: VerificationState
  dataLabel: string
  missingDataNotes: string[]
  retrievalDate: string | null
  sourceUrl: string
  bodyText: string
  published: boolean
}

export type ScholarshipChange = {
  id: string
  scholarshipId: string
  changedAt: string
  fieldName: string
  oldValue: string | null
  newValue: string | null
  sourceUrl: string | null
  reviewStatus: 'recorded' | 'needs_review' | 'accepted'
}

export type Profile = {
  id: string
  email: string
  displayName: string
  citizenship: string
  residenceCountry: string
  currentDegree: string
  institution: string
  fieldOfStudy: string
  gpa: number | null
  gpaScale: number | null
  graduationYear: number | null
  intendedDegree: Degree | ''
  researchInterests: string
  destinationPreferences: string[]
  fundingNeed: FundingType | ''
  languageTests: LanguageTest[]
  relevantExperience: string
  workExperience: string
  experienceYears: number | null
  locale: Locale
  timezone: string
  role: 'student' | 'admin'
  createdAt: string
}

export type Application = {
  id: string
  userId: string
  scholarshipId: string
  workspaceStatus: WorkspaceStatus
  preparationProgress: number
  submittedAt: string | null
  confirmationReference: string
  officialDeadlineAt: string | null
  notes: string
  createdAt: string
  updatedAt: string
}

export type ApplicationTask = {
  id: string
  applicationId: string
  userId: string
  title: string
  done: boolean
}

export type VaultDocument = {
  id: string
  userId: string
  kind: DocumentKind
  originalName: string
  safeName: string
  mimeType: string
  byteSize: number
  extractedText: string
  createdAt: string
}

export type DocumentAttachment = {
  documentId: string
  applicationId: string
  userId: string
}

export type LetterDraft = {
  id: string
  userId: string
  scholarshipId: string
  applicationId: string | null
  title: string
  body: string
  updatedAt: string
}

export type LetterVersion = {
  id: string
  letterId: string
  userId: string
  label: string
  body: string
  createdAt: string
}

export type CommunityPost = {
  id: string
  scholarshipId: string
  userId: string | null
  displayName: string
  channel: CommunityChannel
  body: string
  parentId: string | null
  deleted: boolean
  createdAt: string
}

export type NotificationItem = {
  id: string
  userId: string
  kind: string
  title: string
  body: string
  read: boolean
  payload: Record<string, string>
  createdAt: string
}

export type ReminderPreferences = {
  userId: string
  inApp: boolean
  email: boolean
  upcomingDays: number
  dueSoonDays: number
  timezone: string
}

export type CriterionResult = {
  id: string
  label: string
  status: CriterionStatus
  officialSource: string
  explanation: string
}

export type EligibilityResult = {
  outcome: EligibilityOutcome
  criteria: CriterionResult[]
}

export type MatchResult = {
  scholarship: Scholarship
  eligibility: EligibilityResult
  suitability: number | null
  why: string[]
  strengths: string[]
  missing: string[]
  unmet: string[]
}

export type NlConstraints = {
  query: string
  degrees: Array<'masters' | 'phd'>
  countries: string[]
  fields: string[]
  funding: FundingType | ''
  openStatus: OpenStatus | ''
  nationality: string
  interpreter: 'local_rules'
}

export type HelpArticle = {
  slug: string
  kind: 'help' | 'guide' | 'faq'
  title: { en: string; ar: string }
  body: { en: string; ar: string }
}

export type ProviderProposal = {
  id: string
  organization: string
  contactEmail: string
  listingTitle: string
  officialSourceUrl: string
  notes: string
  status: 'pending_review' | 'needs_info' | 'approved' | 'rejected'
  createdAt: string
}

export type ContactMessage = {
  id: string
  name: string
  email: string
  topic: string
  message: string
  createdAt: string
}

export type ReminderDelivery = {
  id: string
  userId: string
  applicationId: string | null
  channel: 'email' | 'in_app'
  status: 'sent' | 'unconfigured' | 'failed'
  detail: string
  createdAt: string
}

export type AssistantMessage = {
  id: string
  conversationId: string
  role: 'user' | 'assistant'
  content: string
  citations: Array<{ label: string; passage: string; kind: 'official' | 'document' | 'suggestion' }>
}
