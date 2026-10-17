import { Link } from 'react-router-dom'
import type { Scholarship } from '../domain/types'
import { useMada } from '../app/state'

export function ScholarshipCard({ scholarship }: { scholarship: Scholarship }) {
  const { t } = useMada()
  return (
    <article className="card">
      <div className="cluster">
        <span className="badge">{scholarship.provider}</span>
        <span className="badge">{scholarship.openStatus}</span>
      </div>
      <h3>
        <Link to={`/scholarships/${scholarship.slug}`}>{scholarship.title}</Link>
      </h3>
      <p className="muted">
        {scholarship.destinationCountries.join(', ')} · {scholarship.supportedDegrees.join(', ')} ·{' '}
        {scholarship.fundingType} funding
      </p>
      <p>
        Deadline:{' '}
        {scholarship.deadlineAt
          ? `${scholarship.deadlineAt}${scholarship.deadlineTimezone ? ` (${scholarship.deadlineTimezone})` : ''}`
          : 'unknown'}{' '}
        · {scholarship.deadlineCertainty}
      </p>
      <p className="badge">{scholarship.dataLabel}</p>
      <div className="cluster">
        <Link className="btn ghost" to={`/scholarships/${scholarship.slug}`}>
          {t.actions.explore}
        </Link>
      </div>
    </article>
  )
}
