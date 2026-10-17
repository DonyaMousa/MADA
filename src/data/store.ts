import { transitionStatus } from '../domain/applications'
import { emptyProfile } from '../domain/profileCompleteness'
import type {
  Application,
  ApplicationTask,
  AssistantMessage,
  CommunityChannel,
  CommunityPost,
  ContactMessage,
  DocumentAttachment,
  DocumentKind,
  HelpArticle,
  LetterDraft,
  LetterVersion,
  NotificationItem,
  Profile,
  ProviderProposal,
  ReminderDelivery,
  ReminderPreferences,
  Scholarship,
  ScholarshipChange,
  VaultDocument,
  WorkspaceStatus,
} from '../domain/types'
import { seedArticles } from './seedContent'
import { seedScholarships } from './seedScholarships'

export class StoreError extends Error {
  readonly code: 'auth' | 'forbidden' | 'not_found' | 'invalid' | 'rate_limit'

  constructor(
    message: string,
    code: StoreError['code'],
  ) {
    super(message)
    this.code = code
  }
}

export type Session = { userId: string; email: string }

type Account = { id: string; email: string; passwordHash: string }

export type SerializedState = {
  accounts: Account[]
  profiles: Profile[]
  scholarships: Scholarship[]
  changes: ScholarshipChange[]
  saved: Array<{ userId: string; scholarshipId: string }>
  applications: Application[]
  tasks: ApplicationTask[]
  documents: VaultDocument[]
  attachments: DocumentAttachment[]
  letters: LetterDraft[]
  versions: LetterVersion[]
  memberships: Array<{ userId: string; scholarshipId: string; displayName: string }>
  posts: CommunityPost[]
  reports: Array<{ id: string; postId: string; reporterId: string; reason: string }>
  notifications: NotificationItem[]
  reminders: ReminderPreferences[]
  deliveries: ReminderDelivery[]
  proposals: ProviderProposal[]
  contacts: ContactMessage[]
  articles: HelpArticle[]
  conversations: Array<{
    id: string
    userId: string
    scholarshipId: string
    applicationId: string | null
    includeAttachments: boolean
  }>
  messages: AssistantMessage[]
  ratePosts: Array<{ userId: string; at: number }>
  audit: Array<{ id: string; actorId: string; action: string; detail: string; at: string }>
}

function nowIso(): string {
  return new Date().toISOString()
}

function id(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`
}

async function hashPassword(password: string): Promise<string> {
  const data = new TextEncoder().encode(`mada:${password}`)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('')
}

export function safeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]+/g, '_').slice(0, 80) || 'file'
}

const ALLOWED_MIME = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'text/plain',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
])

export class MadaStore {
  accounts: Account[] = []
  profiles: Profile[] = []
  scholarships: Scholarship[] = structuredClone(seedScholarships)
  changes: ScholarshipChange[] = []
  saved: Array<{ userId: string; scholarshipId: string }> = []
  applications: Application[] = []
  tasks: ApplicationTask[] = []
  documents: VaultDocument[] = []
  files = new Map<string, { blob: Blob }>()
  attachments: DocumentAttachment[] = []
  letters: LetterDraft[] = []
  versions: LetterVersion[] = []
  memberships: Array<{ userId: string; scholarshipId: string; displayName: string }> = []
  posts: CommunityPost[] = []
  reports: Array<{ id: string; postId: string; reporterId: string; reason: string }> = []
  notifications: NotificationItem[] = []
  reminders: ReminderPreferences[] = []
  deliveries: ReminderDelivery[] = []
  proposals: ProviderProposal[] = []
  contacts: ContactMessage[] = []
  articles: HelpArticle[] = structuredClone(seedArticles)
  conversations: SerializedState['conversations'] = []
  messages: AssistantMessage[] = []
  ratePosts: Array<{ userId: string; at: number }> = []
  audit: SerializedState['audit'] = []
  session: Session | null = null

  serialize(): SerializedState {
    return {
      accounts: this.accounts,
      profiles: this.profiles,
      scholarships: this.scholarships,
      changes: this.changes,
      saved: this.saved,
      applications: this.applications,
      tasks: this.tasks,
      documents: this.documents,
      attachments: this.attachments,
      letters: this.letters,
      versions: this.versions,
      memberships: this.memberships,
      posts: this.posts,
      reports: this.reports,
      notifications: this.notifications,
      reminders: this.reminders,
      deliveries: this.deliveries,
      proposals: this.proposals,
      contacts: this.contacts,
      articles: this.articles,
      conversations: this.conversations,
      messages: this.messages,
      ratePosts: this.ratePosts,
      audit: this.audit,
    }
  }

  hydrate(data: SerializedState): void {
    Object.assign(this, data)
  }

  requireUser(): Session {
    if (!this.session) throw new StoreError('Sign in required.', 'auth')
    return this.session
  }

  requireAdmin(): Session {
    const session = this.requireUser()
    const profile = this.profiles.find((item) => item.id === session.userId)
    if (profile?.role !== 'admin') throw new StoreError('Admin only.', 'forbidden')
    return session
  }

  async signUp(email: string, password: string): Promise<Session> {
    if (!email.includes('@') || password.length < 8) {
      throw new StoreError('Use a valid email and a password of at least 8 characters.', 'invalid')
    }
    if (this.accounts.some((item) => item.email.toLowerCase() === email.toLowerCase())) {
      throw new StoreError('An account with this email already exists.', 'invalid')
    }
    const account = {
      id: id('usr'),
      email: email.toLowerCase(),
      passwordHash: await hashPassword(password),
    }
    this.accounts.push(account)
    const profile = emptyProfile(account.id, account.email)
    this.profiles.push(profile)
    this.reminders.push({
      userId: account.id,
      inApp: true,
      email: false,
      upcomingDays: 14,
      dueSoonDays: 3,
      timezone: 'Africa/Cairo',
    })
    this.session = { userId: account.id, email: account.email }
    return this.session
  }

  async signIn(email: string, password: string): Promise<Session> {
    const account = this.accounts.find((item) => item.email === email.toLowerCase())
    if (!account || account.passwordHash !== (await hashPassword(password))) {
      throw new StoreError('Email or password is incorrect.', 'auth')
    }
    this.session = { userId: account.id, email: account.email }
    return this.session
  }

  signOut(): void {
    this.session = null
  }

  async resetPassword(email: string, nextPassword: string): Promise<void> {
    const account = this.accounts.find((item) => item.email === email.toLowerCase())
    if (!account) return
    if (nextPassword.length < 8) throw new StoreError('Password too short.', 'invalid')
    account.passwordHash = await hashPassword(nextPassword)
  }

  deleteAccount(userId: string): void {
    const session = this.requireUser()
    if (session.userId !== userId) throw new StoreError('You can only delete your own account.', 'forbidden')
    for (const post of this.posts) {
      if (post.userId === userId) {
        post.userId = null
        post.displayName = '[deleted]'
        post.body = '[deleted]'
        post.deleted = true
      }
    }
    this.files.forEach((_, key) => {
      if (key.startsWith(`${userId}/`)) this.files.delete(key)
    })
    this.documents = this.documents.filter((item) => item.userId !== userId)
    this.attachments = this.attachments.filter((item) => item.userId !== userId)
    this.applications = this.applications.filter((item) => item.userId !== userId)
    this.tasks = this.tasks.filter((item) => item.userId !== userId)
    this.letters = this.letters.filter((item) => item.userId !== userId)
    this.versions = this.versions.filter((item) => item.userId !== userId)
    this.saved = this.saved.filter((item) => item.userId !== userId)
    this.memberships = this.memberships.filter((item) => item.userId !== userId)
    this.notifications = this.notifications.filter((item) => item.userId !== userId)
    this.reminders = this.reminders.filter((item) => item.userId !== userId)
    this.conversations = this.conversations.filter((item) => item.userId !== userId)
    this.profiles = this.profiles.filter((item) => item.id !== userId)
    this.accounts = this.accounts.filter((item) => item.id !== userId)
    this.session = null
  }

  getProfile(userId: string): Profile {
    const session = this.requireUser()
    if (session.userId !== userId && this.profile(session.userId)?.role !== 'admin') {
      throw new StoreError('Cannot read another student’s profile.', 'forbidden')
    }
    const profile = this.profiles.find((item) => item.id === userId)
    if (!profile) throw new StoreError('Profile not found.', 'not_found')
    return profile
  }

  profile(userId: string): Profile | undefined {
    return this.profiles.find((item) => item.id === userId)
  }

  updateProfile(userId: string, patch: Partial<Profile>): Profile {
    const session = this.requireUser()
    if (session.userId !== userId) throw new StoreError('Cannot edit another profile.', 'forbidden')
    const profile = this.profiles.find((item) => item.id === userId)
    if (!profile) throw new StoreError('Profile not found.', 'not_found')
    const { id: _id, email, role, createdAt, ...rest } = patch
    Object.assign(profile, rest, { id: profile.id, email: profile.email, role: profile.role, createdAt })
    return profile
  }

  listPublishedScholarships(): Scholarship[] {
    return this.scholarships.filter((item) => item.published && item.verificationState !== 'archived')
  }

  getScholarship(slugOrId: string): Scholarship | undefined {
    return this.listPublishedScholarships().find((item) => item.slug === slugOrId || item.id === slugOrId)
  }

  toggleSave(scholarshipId: string): boolean {
    const { userId } = this.requireUser()
    const existing = this.saved.find(
      (item) => item.userId === userId && item.scholarshipId === scholarshipId,
    )
    if (existing) {
      this.saved = this.saved.filter((item) => item !== existing)
      return false
    }
    this.saved.push({ userId, scholarshipId })
    return true
  }

  isSaved(scholarshipId: string): boolean {
    if (!this.session) return false
    return this.saved.some(
      (item) => item.userId === this.session?.userId && item.scholarshipId === scholarshipId,
    )
  }

  createApplication(scholarshipId: string): Application {
    const { userId } = this.requireUser()
    const scholarship = this.getScholarship(scholarshipId)
    if (!scholarship) throw new StoreError('Scholarship not found.', 'not_found')
    const existing = this.applications.find(
      (item) => item.userId === userId && item.scholarshipId === scholarship.id,
    )
    if (existing) return existing
    if (!this.isSaved(scholarship.id)) this.saved.push({ userId, scholarshipId: scholarship.id })
    const application: Application = {
      id: id('app'),
      userId,
      scholarshipId: scholarship.id,
      workspaceStatus: 'saved',
      preparationProgress: 0,
      submittedAt: null,
      confirmationReference: '',
      officialDeadlineAt: scholarship.deadlineAt,
      notes: '',
      createdAt: nowIso(),
      updatedAt: nowIso(),
    }
    this.applications.push(application)
    for (const doc of scholarship.requiredDocuments) {
      this.tasks.push({
        id: id('task'),
        applicationId: application.id,
        userId,
        title: `Prepare: ${doc.label}`,
        done: false,
      })
    }
    return application
  }

  listApplications(): Application[] {
    const { userId } = this.requireUser()
    return this.applications.filter((item) => item.userId === userId)
  }

  getApplication(applicationId: string): Application {
    const { userId } = this.requireUser()
    const application = this.applications.find((item) => item.id === applicationId)
    if (!application || application.userId !== userId) {
      throw new StoreError('Application not found.', 'not_found')
    }
    return application
  }

  updateApplicationStatus(
    applicationId: string,
    status: WorkspaceStatus,
    extras?: { confirmationReference?: string },
  ): Application {
    const application = this.getApplication(applicationId)
    const result = transitionStatus(application.workspaceStatus, status)
    if (!result.ok) throw new StoreError(result.error, 'invalid')
    application.workspaceStatus = result.status
    application.updatedAt = nowIso()
    if (status === 'submitted') {
      application.submittedAt = nowIso()
      application.confirmationReference = extras?.confirmationReference ?? application.confirmationReference
    }
    return application
  }

  addTask(applicationId: string, title: string): ApplicationTask {
    const application = this.getApplication(applicationId)
    const task: ApplicationTask = {
      id: id('task'),
      applicationId: application.id,
      userId: application.userId,
      title,
      done: false,
    }
    this.tasks.push(task)
    return task
  }

  toggleTask(taskId: string): ApplicationTask {
    const { userId } = this.requireUser()
    const task = this.tasks.find((item) => item.id === taskId)
    if (!task || task.userId !== userId) throw new StoreError('Task not found.', 'not_found')
    task.done = !task.done
    const related = this.tasks.filter((item) => item.applicationId === task.applicationId)
    const application = this.getApplication(task.applicationId)
    application.preparationProgress = related.length
      ? Math.round((related.filter((item) => item.done).length / related.length) * 100)
      : 0
    return task
  }

  uploadDocument(input: {
    kind: DocumentKind
    file: { name: string; type: string; size: number; text?: string; blob?: Blob }
  }): VaultDocument {
    const { userId } = this.requireUser()
    if (input.file.size > 10 * 1024 * 1024) throw new StoreError('Files must be 10 MB or smaller.', 'invalid')
    if (input.file.type && !ALLOWED_MIME.has(input.file.type) && input.file.type !== '') {
      throw new StoreError('That file type is not allowed.', 'invalid')
    }
    const doc: VaultDocument = {
      id: id('doc'),
      userId,
      kind: input.kind,
      originalName: input.file.name,
      safeName: safeFileName(input.file.name),
      mimeType: input.file.type || 'application/octet-stream',
      byteSize: input.file.size,
      extractedText: input.file.text ?? '',
      createdAt: nowIso(),
    }
    this.documents.push(doc)
    if (input.file.blob) this.files.set(`${userId}/${doc.id}/${doc.safeName}`, { blob: input.file.blob })
    return doc
  }

  listDocuments(): VaultDocument[] {
    const { userId } = this.requireUser()
    return this.documents.filter((item) => item.userId === userId)
  }

  getDocument(documentId: string): VaultDocument {
    const { userId } = this.requireUser()
    const doc = this.documents.find((item) => item.id === documentId)
    if (!doc || doc.userId !== userId) throw new StoreError('File not found.', 'not_found')
    return doc
  }

  deleteDocument(documentId: string): void {
    const doc = this.getDocument(documentId)
    doc.extractedText = ''
    this.attachments = this.attachments.filter((item) => item.documentId !== documentId)
    this.documents = this.documents.filter((item) => item.id !== documentId)
    for (const key of [...this.files.keys()]) {
      if (key.includes(`/${documentId}/`)) this.files.delete(key)
    }
  }

  renameDocument(documentId: string, originalName: string): VaultDocument {
    const doc = this.getDocument(documentId)
    doc.originalName = originalName
    doc.safeName = safeFileName(originalName)
    return doc
  }

  attachDocument(documentId: string, applicationId: string): void {
    const doc = this.getDocument(documentId)
    const application = this.getApplication(applicationId)
    if (doc.userId !== application.userId) {
      throw new StoreError('Cannot attach another user’s file.', 'forbidden')
    }
    if (
      !this.attachments.some(
        (item) => item.documentId === documentId && item.applicationId === applicationId,
      )
    ) {
      this.attachments.push({ documentId, applicationId, userId: doc.userId })
    }
  }

  detachDocument(documentId: string, applicationId: string): void {
    const { userId } = this.requireUser()
    this.attachments = this.attachments.filter(
      (item) =>
        !(item.documentId === documentId && item.applicationId === applicationId && item.userId === userId),
    )
  }

  applicationsForDocument(documentId: string): string[] {
    const doc = this.getDocument(documentId)
    return this.attachments.filter((item) => item.documentId === doc.id).map((item) => item.applicationId)
  }

  createLetter(scholarshipId: string, applicationId: string | null, title: string): LetterDraft {
    const { userId } = this.requireUser()
    const letter: LetterDraft = {
      id: id('ltr'),
      userId,
      scholarshipId,
      applicationId,
      title,
      body: '',
      updatedAt: nowIso(),
    }
    this.letters.push(letter)
    return letter
  }

  saveLetter(letterId: string, body: string, title?: string): LetterDraft {
    const { userId } = this.requireUser()
    const letter = this.letters.find((item) => item.id === letterId)
    if (!letter || letter.userId !== userId) throw new StoreError('Letter not found.', 'not_found')
    letter.body = body
    if (title) letter.title = title
    letter.updatedAt = nowIso()
    return letter
  }

  snapshotLetter(letterId: string, label: string): LetterVersion {
    const { userId } = this.requireUser()
    const letter = this.letters.find((item) => item.id === letterId)
    if (!letter || letter.userId !== userId) throw new StoreError('Letter not found.', 'not_found')
    const version: LetterVersion = {
      id: id('ver'),
      letterId,
      userId,
      label,
      body: letter.body,
      createdAt: nowIso(),
    }
    this.versions.push(version)
    return version
  }

  duplicateLetter(letterId: string): LetterDraft {
    const { userId } = this.requireUser()
    const letter = this.letters.find((item) => item.id === letterId)
    if (!letter || letter.userId !== userId) throw new StoreError('Letter not found.', 'not_found')
    return this.createLetter(letter.scholarshipId, letter.applicationId, `${letter.title} copy`)
  }

  deleteLetter(letterId: string): void {
    const { userId } = this.requireUser()
    const letter = this.letters.find((item) => item.id === letterId)
    if (!letter || letter.userId !== userId) throw new StoreError('Letter not found.', 'not_found')
    this.letters = this.letters.filter((item) => item.id !== letterId)
    this.versions = this.versions.filter((item) => item.letterId !== letterId)
  }

  joinCommunity(scholarshipId: string): void {
    const { userId } = this.requireUser()
    const profile = this.getProfile(userId)
    if (this.memberships.some((item) => item.userId === userId && item.scholarshipId === scholarshipId)) {
      return
    }
    this.memberships.push({
      userId,
      scholarshipId,
      displayName: profile.displayName || profile.email.split('@')[0],
    })
  }

  communityPosts(scholarshipId: string, channel: CommunityChannel): CommunityPost[] {
    const { userId } = this.requireUser()
    if (!this.memberships.some((item) => item.userId === userId && item.scholarshipId === scholarshipId)) {
      throw new StoreError('Join the community to read posts.', 'forbidden')
    }
    return this.posts.filter((item) => item.scholarshipId === scholarshipId && item.channel === channel)
  }

  addPost(scholarshipId: string, channel: CommunityChannel, body: string, parentId: string | null = null): CommunityPost {
    const { userId } = this.requireUser()
    this.joinCommunity(scholarshipId)
    const cutoff = Date.now() - 10 * 60 * 1000
    const recent = this.ratePosts.filter((item) => item.userId === userId && item.at > cutoff)
    if (recent.length >= 10) throw new StoreError('Please wait before posting again.', 'rate_limit')
    const member = this.memberships.find((item) => item.userId === userId && item.scholarshipId === scholarshipId)
    const post: CommunityPost = {
      id: id('post'),
      scholarshipId,
      userId,
      displayName: member?.displayName ?? 'Member',
      channel,
      body,
      parentId,
      deleted: false,
      createdAt: nowIso(),
    }
    this.posts.push(post)
    this.ratePosts.push({ userId, at: Date.now() })
    return post
  }

  editPost(postId: string, body: string): CommunityPost {
    const { userId } = this.requireUser()
    const post = this.posts.find((item) => item.id === postId)
    if (!post || post.userId !== userId) throw new StoreError('You can only edit your own post.', 'forbidden')
    post.body = body
    return post
  }

  deletePost(postId: string): void {
    const { userId } = this.requireUser()
    const post = this.posts.find((item) => item.id === postId)
    if (!post) throw new StoreError('Post not found.', 'not_found')
    const admin = this.profile(userId)?.role === 'admin'
    if (post.userId !== userId && !admin) throw new StoreError('You can only delete your own post.', 'forbidden')
    post.deleted = true
    post.body = '[deleted]'
  }

  reportPost(postId: string, reason: string): void {
    const { userId } = this.requireUser()
    this.reports.push({ id: id('rep'), postId, reporterId: userId, reason })
  }

  notify(userId: string, kind: string, title: string, body: string, payload: Record<string, string> = {}): void {
    this.notifications.unshift({
      id: id('ntf'),
      userId,
      kind,
      title,
      body,
      read: false,
      payload,
      createdAt: nowIso(),
    })
  }

  listNotifications(): NotificationItem[] {
    const { userId } = this.requireUser()
    return this.notifications.filter((item) => item.userId === userId)
  }

  proposeListing(input: Omit<ProviderProposal, 'id' | 'status' | 'createdAt'>): ProviderProposal {
    const proposal: ProviderProposal = {
      ...input,
      id: id('prop'),
      status: 'pending_review',
      createdAt: nowIso(),
    }
    this.proposals.push(proposal)
    return proposal
  }

  contact(input: Omit<ContactMessage, 'id' | 'createdAt'>): ContactMessage {
    const message: ContactMessage = { ...input, id: id('msg'), createdAt: nowIso() }
    this.contacts.push(message)
    return message
  }

  adminUpsertScholarship(scholarship: Scholarship): void {
    const { userId } = this.requireAdmin()
    const index = this.scholarships.findIndex((item) => item.id === scholarship.id)
    const previous = index >= 0 ? this.scholarships[index] : null
    if (index >= 0) this.scholarships[index] = scholarship
    else this.scholarships.push(scholarship)
    if (previous) {
      for (const field of ['deadlineAt', 'officialApplicationUrl', 'eligibilitySummary', 'fundingType'] as const) {
        if (previous[field] !== scholarship[field]) {
          this.changes.push({
            id: id('chg'),
            scholarshipId: scholarship.id,
            changedAt: nowIso(),
            fieldName: field,
            oldValue: String(previous[field] ?? ''),
            newValue: String(scholarship[field] ?? ''),
            sourceUrl: scholarship.sourceUrl,
            reviewStatus: 'recorded',
          })
          for (const save of this.saved.filter((item) => item.scholarshipId === scholarship.id)) {
            this.notify(
              save.userId,
              'listing_change',
              `${scholarship.title} was updated`,
              `${field} changed. Review the verified source before relying on the new value.`,
              {
                scholarshipId: scholarship.id,
                field,
                oldValue: String(previous[field] ?? ''),
                newValue: String(scholarship[field] ?? ''),
              },
            )
          }
        }
      }
    }
    this.audit.push({
      id: id('aud'),
      actorId: userId,
      action: 'upsert_scholarship',
      detail: scholarship.slug,
      at: nowIso(),
    })
  }

  recordReminderRun(unconfigured: boolean): void {
    const channel: 'email' | 'in_app' = unconfigured ? 'email' : 'email'
    for (const pref of this.reminders) {
      if (!pref.email && !pref.inApp) continue
      this.deliveries.push({
        id: id('dlv'),
        userId: pref.userId,
        applicationId: null,
        channel,
        status: unconfigured ? 'unconfigured' : 'sent',
        detail: unconfigured ? 'SMTP is not configured on the API server.' : 'Queued locally.',
        createdAt: nowIso(),
      })
    }
  }
}

export const store = new MadaStore()
