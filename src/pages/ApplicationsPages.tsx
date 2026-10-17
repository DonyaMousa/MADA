import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useMada } from '../app/state'
import { documentReadiness } from '../domain/documentReadiness'
import { answerScholarshipQuestion, assertRetrievalBoundary } from '../domain/retrieval'
import { localSopReview } from '../lib/cvExtract'
import type { WorkspaceStatus } from '../domain/types'

const COLUMNS: WorkspaceStatus[] = [
  'saved',
  'preparing',
  'submitted',
  'shortlisted',
  'accepted',
  'rejected',
  'withdrawn',
]

export function ApplicationsBoardPage() {
  const { store, t } = useMada()
  const [view, setView] = useState<'board' | 'list'>('board')
  const apps = store.listApplications()
  const body = (status: WorkspaceStatus) =>
    apps.filter((item) => item.workspaceStatus === status).map((item) => {
      const sch = store.getScholarship(item.scholarshipId)
      return (
        <Link className="card" key={item.id} to={`/applications/${item.id}`} style={{ display: 'block', marginBottom: '0.5rem' }}>
          <strong>{sch?.title}</strong>
          <p className="muted">Prep {item.preparationProgress}% · {item.officialDeadlineAt ?? 'deadline unknown'}</p>
        </Link>
      )
    })
  return (
    <div className="page">
      <h1>{t.nav.applications}</h1>
      <div className="cluster">
        <button className="btn secondary" type="button" onClick={() => setView('board')}>Board</button>
        <button className="btn secondary" type="button" onClick={() => setView('list')}>List</button>
      </div>
      {apps.length === 0 ? <p className="alert">No applications yet. Open a listing and add it to your workspace.</p> : null}
      {view === 'board' ? (
        <div className="kanban" style={{ marginTop: '1rem' }}>
          {COLUMNS.map((col) => (
            <div className="col" key={col}>
              <strong>{t.status[col]}</strong>
              {body(col)}
            </div>
          ))}
        </div>
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th>Scholarship</th>
              <th>Status</th>
              <th>Prep</th>
              <th>Submitted</th>
            </tr>
          </thead>
          <tbody>
            {apps.map((item) => (
              <tr key={item.id}>
                <td>
                  <Link to={`/applications/${item.id}`}>{store.getScholarship(item.scholarshipId)?.title}</Link>
                </td>
                <td>{item.workspaceStatus}</td>
                <td>{item.preparationProgress}%</td>
                <td>{item.submittedAt ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

export function ApplicationDetailPage() {
  const { id } = useParams()
  const { store, refresh, t } = useMada()
  const application = store.getApplication(id ?? '')
  const scholarship = store.getScholarship(application.scholarshipId)
  const tasks = store.tasks.filter((item) => item.applicationId === application.id)
  const attachedIds = store.attachments.filter((item) => item.applicationId === application.id).map((a) => a.documentId)
  const attached = store.listDocuments().filter((d) => attachedIds.includes(d.id))
  const readiness = scholarship ? documentReadiness(scholarship.requiredDocuments, attached) : []
  const letters = store.letters.filter((l) => l.applicationId === application.id)
  const [qa, setQa] = useState('')
  const [answer, setAnswer] = useState('')
  const [optIn, setOptIn] = useState(false)
  const [aiState, setAiState] = useState('not requested')
  const [statusError, setStatusError] = useState('')

  return (
    <div className="page">
      <h1>{scholarship?.title}</h1>
      <p>
        Workspace status: <strong>{application.workspaceStatus}</strong> · Preparation {application.preparationProgress}% ·
        Submission {application.submittedAt ?? 'not recorded'} · Outcome is the status column, not preparation.
      </p>
      <p className="muted">Official deadline: {application.officialDeadlineAt ?? 'unknown'}</p>
      <div className="cluster">
        <a className="btn" href={scholarship?.officialApplicationUrl} target="_blank" rel="noreferrer">
          {t.actions.applyOfficial}
        </a>
        <span className="muted">This link never changes status by itself.</span>
      </div>
      {statusError ? <p className="alert error">{statusError}</p> : null}
      <label>
        Change status deliberately
        <select
          value={application.workspaceStatus}
          onChange={(e) => {
            try {
              store.updateApplicationStatus(application.id, e.target.value as WorkspaceStatus)
              setStatusError('')
              refresh()
            } catch (err) {
              setStatusError(err instanceof Error ? err.message : 'Invalid status change')
            }
          }}
        >
          {COLUMNS.map((c) => (
            <option key={c} value={c}>
              {t.status[c]}
            </option>
          ))}
        </select>
      </label>
      {application.workspaceStatus === 'submitted' ? (
        <label>
          Optional confirmation reference
          <input
            defaultValue={application.confirmationReference}
            onBlur={(e) => {
              application.confirmationReference = e.target.value
              refresh()
            }}
          />
        </label>
      ) : (
        <button
          className="btn secondary"
          type="button"
          onClick={() => {
            try {
              store.updateApplicationStatus(application.id, 'submitted')
              refresh()
            } catch (err) {
              setStatusError(err instanceof Error ? err.message : 'Cannot mark submitted from this state')
            }
          }}
        >
          {t.actions.submitRecord}
        </button>
      )}
      <section className="card">
        <h2>Checklist / tasks</h2>
        {tasks.map((task) => (
          <label key={task.id}>
            <input type="checkbox" checked={task.done} onChange={() => { store.toggleTask(task.id); refresh() }} /> {task.title}
          </label>
        ))}
        <form
          className="cluster"
          onSubmit={(e) => {
            e.preventDefault()
            const form = new FormData(e.currentTarget)
            store.addTask(application.id, String(form.get('title')))
            refresh()
            e.currentTarget.reset()
          }}
        >
          <input name="title" placeholder="Personal task" required />
          <button className="btn" type="submit">Add task</button>
        </form>
      </section>
      <section className="card">
        <h2>Notes</h2>
        <textarea
          defaultValue={application.notes}
          onBlur={(e) => {
            application.notes = e.target.value
            refresh()
          }}
        />
      </section>
      <section className="card">
        <h2>Document readiness</h2>
        <p className="muted">Compares stated requirements to files you explicitly attached. Not a quality judgement.</p>
        {readiness.map((row) => (
          <p key={row.requirement.id}>
            <span className="badge">{row.status}</span> {row.requirement.label}: {row.note}
          </p>
        ))}
        <Link to="/documents">Vault</Link>
      </section>
      <section className="card">
        <h2>Letters</h2>
        {letters.map((letter) => (
          <p key={letter.id}>
            <Link to={`/letters/${letter.id}`}>{letter.title}</Link>
          </p>
        ))}
        <button
          className="btn"
          type="button"
          onClick={() => {
            store.createLetter(application.scholarshipId, application.id, `SOP · ${scholarship?.title}`)
            refresh()
          }}
        >
          New draft
        </button>
      </section>
      <section className="card">
        <h2>Scholarship Q&A</h2>
        <p className="muted">Retrieves verified catalog text for this listing only. Opt in to include this application’s attachments.</p>
        <label>
          <input type="checkbox" checked={optIn} onChange={(e) => setOptIn(e.target.checked)} /> Include attached document text (explicit opt-in)
        </label>
        <textarea value={qa} onChange={(e) => setQa(e.target.value)} placeholder="Ask about eligibility, documents, or deadlines" />
        <button
          className="btn"
          type="button"
          onClick={async () => {
            const conv = { scholarshipId: application.scholarshipId, applicationId: application.id }
            const boundary = assertRetrievalBoundary({
              conversationScholarshipId: conv.scholarshipId,
              requestedScholarshipId: application.scholarshipId,
              conversationApplicationId: conv.applicationId,
              requestedApplicationId: application.id,
            })
            if (!boundary.ok) {
              setAnswer(boundary.error)
              return
            }
            let remote: { ok: boolean; provider?: string } | null = null
            try {
              const res = await fetch('/api/ai/qa', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ question: qa, scholarshipId: application.scholarshipId }),
              })
              remote = await res.json()
            } catch {
              remote = null
            }
            if (remote && 'provider' in remote && remote.provider === 'ai') {
              setAiState('AI provider responded')
            } else {
              setAiState('AI unconfigured; local retrieval used')
            }
            const result = answerScholarshipQuestion({
              request: {
                scholarshipId: application.scholarshipId,
                applicationId: application.id,
                includeAttachments: optIn,
                question: qa,
                allowedDocumentIds: optIn ? attached.map((d) => d.id) : [],
              },
              scholarship: scholarship ?? null,
              documents: attached,
            })
            setAnswer(
              `${result.content}\n\nCitations:\n${result.citations.map((c) => `- [${c.kind}] ${c.label}: ${c.passage}`).join('\n')}`,
            )
          }}
        >
          Ask
        </button>
        <p className="muted">{aiState}</p>
        {answer ? <pre style={{ whiteSpace: 'pre-wrap' }}>{answer}</pre> : null}
      </section>
      <SopBox scholarshipSummary={scholarship?.eligibilitySummary ?? ''} />
    </div>
  )
}

function SopBox({ scholarshipSummary }: { scholarshipSummary: string }) {
  const [text, setText] = useState('')
  const [out, setOut] = useState('')
  return (
    <section className="card">
      <h2>SOP reviewer</h2>
      <p className="muted">Feedback is labeled with its provider. Voice stays yours.</p>
      <textarea value={text} onChange={(e) => setText(e.target.value)} />
      <button
        className="btn secondary"
        type="button"
        onClick={async () => {
          try {
            const res = await fetch('/api/ai/sop-review', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ text, scholarshipSummary }),
            })
            const data = await res.json()
            if (data.provider === 'ai') {
              setOut(`Generated by AI (${data.model}). You may reject any suggestion.\n${data.feedback}`)
              return
            }
          } catch {
            /* fall through */
          }
          const local = localSopReview(text, scholarshipSummary)
          setOut(`Not an AI model review (${local.provider}).\n${local.bullets.map((b) => `• ${b}`).join('\n')}`)
        }}
      >
        Review draft
      </button>
      {out ? <pre style={{ whiteSpace: 'pre-wrap' }}>{out}</pre> : null}
    </section>
  )
}
