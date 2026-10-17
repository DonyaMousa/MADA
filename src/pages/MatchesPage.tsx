import { Link } from 'react-router-dom'
import { useMada } from '../app/state'
import { rankScholarships } from '../domain/matching'

export function MatchesPage() {
  const { store, session, t } = useMada()
  if (!session) return null
  const profile = store.getProfile(session.userId)
  const ranked = rankScholarships(profile, store.listPublishedScholarships())
  return (
    <div className="page">
      <h1>{t.nav.matches}</h1>
      <p className="muted">{t.eligibility.scoreNote} Hard disqualification is never hidden behind a score.</p>
      {ranked.map((item) => (
        <article className="card" key={item.scholarship.id} style={{ marginBottom: '0.8rem' }}>
          <div className="cluster">
            <span className="badge gold">{item.eligibility.outcome}</span>
            {item.suitability != null ? <span className="badge">Suitability {item.suitability}/100</span> : <span className="badge">No suitability score</span>}
          </div>
          <h2>
            <Link to={`/scholarships/${item.scholarship.slug}`}>{item.scholarship.title}</Link>
          </h2>
          <p>Why: {item.why.join(' ')}</p>
          {item.strengths[0] ? <p>Strengths: {item.strengths.join(' ')}</p> : null}
          {item.missing[0] ? <p>Missing information: {item.missing.join(' ')}</p> : null}
          {item.unmet[0] ? <p>Unmet: {item.unmet.join(' ')}</p> : null}
        </article>
      ))}
    </div>
  )
}
