import type { WorkspaceStatus } from './types'

const ALLOWED: Record<WorkspaceStatus, WorkspaceStatus[]> = {
  saved: ['preparing', 'withdrawn'],
  preparing: ['submitted', 'withdrawn', 'saved'],
  submitted: ['shortlisted', 'accepted', 'rejected', 'withdrawn'],
  shortlisted: ['accepted', 'rejected', 'withdrawn'],
  accepted: ['withdrawn'],
  rejected: ['withdrawn'],
  withdrawn: [],
}

export function canTransition(from: WorkspaceStatus, to: WorkspaceStatus): boolean {
  if (from === to) return true
  return ALLOWED[from].includes(to)
}

export function transitionStatus(
  from: WorkspaceStatus,
  to: WorkspaceStatus,
): { ok: true; status: WorkspaceStatus } | { ok: false; error: string } {
  if (!canTransition(from, to)) {
    return {
      ok: false,
      error: `Cannot move an application from ${from} to ${to}. Submission is never inferred from opening the official apply link.`,
    }
  }
  return { ok: true, status: to }
}

export function deadlineBucket(
  deadlineAt: string | null,
  now = new Date(),
): 'upcoming' | 'due_soon' | 'passed' | 'unknown' {
  if (!deadlineAt) return 'unknown'
  const due = new Date(deadlineAt).getTime()
  const diff = due - now.getTime()
  if (Number.isNaN(due)) return 'unknown'
  if (diff < 0) return 'passed'
  const days = diff / 86_400_000
  if (days <= 3) return 'due_soon'
  return 'upcoming'
}
