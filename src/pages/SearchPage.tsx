import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ScholarshipCard } from '../components/ScholarshipCard'
import { useMada } from '../app/state'
import { applyNlConstraints, interpretQuery } from '../domain/nlSearch'
import type { FundingType, OpenStatus } from '../domain/types'

export function SearchPage() {
  const { store } = useMada()
  const [params, setParams] = useSearchParams()
  const initial = params.get('q') ?? ''
  const [query, setQuery] = useState(initial)
  const [constraints, setConstraints] = useState(() => interpretQuery(initial))

  const results = useMemo(
    () => applyNlConstraints(store.listPublishedScholarships(), constraints),
    [store, constraints],
  )

  return (
    <div className="page">
      <h1>Natural-language search</h1>
      <p className="muted">
        Interpreter: <strong>local_rules</strong>. This is not a hosted AI model. Personal eligibility
        scores are on My matches after you sign in.
      </p>
      <form
        className="cluster"
        onSubmit={(e) => {
          e.preventDefault()
          const next = interpretQuery(query)
          setConstraints(next)
          setParams({ q: query })
        }}
      >
        <label style={{ flex: 1 }}>
          Query
          <input value={query} onChange={(e) => setQuery(e.target.value)} />
        </label>
        <button className="btn" type="submit">
          Search
        </button>
      </form>
      <div className="card grid cols-3" style={{ marginTop: '1rem' }}>
        <label>
          Degrees
          <input
            value={constraints.degrees.join(', ')}
            onChange={(e) =>
              setConstraints({
                ...constraints,
                degrees: e.target.value
                  .split(',')
                  .map((v) => v.trim())
                  .filter((v): v is 'masters' | 'phd' => v === 'masters' || v === 'phd'),
              })
            }
          />
        </label>
        <label>
          Countries
          <input
            value={constraints.countries.join(', ')}
            onChange={(e) =>
              setConstraints({
                ...constraints,
                countries: e.target.value.split(',').map((v) => v.trim()).filter(Boolean),
              })
            }
          />
        </label>
        <label>
          Fields
          <input
            value={constraints.fields.join(', ')}
            onChange={(e) =>
              setConstraints({
                ...constraints,
                fields: e.target.value.split(',').map((v) => v.trim()).filter(Boolean),
              })
            }
          />
        </label>
        <label>
          Funding
          <select
            value={constraints.funding}
            onChange={(e) => setConstraints({ ...constraints, funding: e.target.value as FundingType | '' })}
          >
            <option value="">Any</option>
            <option value="full">Full</option>
            <option value="partial">Partial</option>
          </select>
        </label>
        <label>
          Status
          <select
            value={constraints.openStatus}
            onChange={(e) => setConstraints({ ...constraints, openStatus: e.target.value as OpenStatus | '' })}
          >
            <option value="">Any</option>
            <option value="open">Open</option>
            <option value="unknown">Unknown</option>
          </select>
        </label>
      </div>
      <p>{results.length} listings after applying edited constraints.</p>
      <div className="grid cols-2">
        {results.map((item) => (
          <ScholarshipCard key={item.id} scholarship={item} />
        ))}
      </div>
    </div>
  )
}
