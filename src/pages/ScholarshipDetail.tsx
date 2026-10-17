import { Link, useNavigate, useParams } from 'react-router-dom'
import { useMada } from '../app/state'
import { rankScholarship } from '../domain/matching'

export function ScholarshipDetailPage() {
  const { slug } = useParams()
  const { t, store, session, refresh } = useMada()
  const navigate = useNavigate()
  const scholarship = store.getScholarship(slug ?? '')
  if (!scholarship) {
    return (
      <div className="page">
        <p className="alert error">Listing not found.</p>
      </div>
    )
  }
  const profile = session ? store.profile(session.userId) : null
  const match = profile ? rankScholarship(profile, scholarship) : null
  const saved = store.isSaved(scholarship.id)

  return (
    <div className="page">
      <p className="badge">{scholarship.dataLabel}</p>
      <h1>{scholarship.title}</h1>
      <p className="muted">
        {scholarship.provider} · last verified {scholarship.lastVerifiedAt ?? 'unknown'} ·{' '}
        {scholarship.verificationState}
      </p>
      <div className="cluster">
        {session ? (
          <button
            className="btn secondary"
            type="button"
            onClick={() => {
              store.toggleSave(scholarship.id)
              refresh()
            }}
          >
            {saved ? t.actions.unsave : t.actions.save}
          </button>
        ) : null}
        {session ? (
          <button
            className="btn"
            type="button"
            onClick={() => {
              const app = store.createApplication(scholarship.id)
              refresh()
              navigate(`/applications/${app.id}`)
            }}
          >
            {t.actions.workspace}
          </button>
        ) : (
          <Link className="btn secondary" to="/signup">
            {t.actions.createProfile}
          </Link>
        )}
        <Link className="btn ghost" to={`/community/${scholarship.id}/general`}>
          {t.actions.community}
        </Link>
        <a className="btn ghost" href={scholarship.officialApplicationUrl} target="_blank" rel="noreferrer">
          {t.actions.applyOfficial}
        </a>
        <a href={scholarship.officialSourceUrl} target="_blank" rel="noreferrer">
          {t.actions.officialSource}
        </a>
      </div>
      <p className="muted">Opening the official apply link does not mark an application as submitted.</p>
      <div className="grid cols-2" style={{ marginTop: '1rem' }}>
        <section className="card">
          <h2>At a glance</h2>
          <p>Destination: {scholarship.destinationCountries.join(', ')}</p>
          <p>Degree: {scholarship.supportedDegrees.join(', ')}</p>
          <p>Funding: {scholarship.fundingType}</p>
          <p>Covered: {scholarship.coveredCosts.join(', ') || 'not listed'}</p>
          <p>
            Deadline:{' '}
            {scholarship.deadlineAt ?? 'unknown'}{' '}
            {scholarship.deadlineTimezone ? `(${scholarship.deadlineTimezone})` : '(timezone not supplied)'}{' '}
            · certainty {scholarship.deadlineCertainty} · status {scholarship.openStatus}
          </p>
          {scholarship.missingDataNotes.map((note) => (
            <p className="badge warn" key={note}>
              {note}
            </p>
          ))}
        </section>
        <section className="card">
          <h2>Eligibility</h2>
          <p>{scholarship.eligibilitySummary}</p>
          <ul>
            {scholarship.eligibilityRules.map((rule) => (
              <li key={rule.id}>
                {rule.label} — <a href={rule.officialSource}>{rule.officialSource}</a>
              </li>
            ))}
          </ul>
        </section>
      </div>
      <section className="card" style={{ marginTop: '1rem' }}>
        <h2>Required documents</h2>
        <ul>
          {scholarship.requiredDocuments.map((doc) => (
            <li key={doc.id}>
              {doc.label} — <a href={doc.officialSource}>{doc.officialSource}</a>
            </li>
          ))}
        </ul>
      </section>
      {match ? (
        <section className="card" style={{ marginTop: '1rem' }}>
          <h2>Your eligibility</h2>
          <p>
            <span className="badge gold">{match.eligibility.outcome}</span>{' '}
            {match.suitability != null ? `Suitability ${match.suitability}/100` : 'Suitability hidden'}
          </p>
          <p className="muted">{t.eligibility.scoreNote}</p>
          <ul>
            {match.eligibility.criteria.map((c) => (
              <li key={c.id}>
                <strong>{c.status}</strong> — {c.label}: {c.explanation} (
                <a href={c.officialSource}>source</a>)
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <p>
          Create a profile to see personal eligibility. Visitors can still search without an account.
        </p>
      )}
    </div>
  )
}
