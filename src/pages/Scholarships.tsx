import { useMemo, useState } from 'react'
import { ScholarshipCard } from '../components/ScholarshipCard'
import { useMada } from '../app/state'
import type { OpenStatus } from '../domain/types'

const PAGE = 6

export function ScholarshipsPage() {
  const { t, store } = useMada()
  const [q, setQ] = useState('')
  const [status, setStatus] = useState<OpenStatus | ''>('')
  const [destination, setDestination] = useState('')
  const [degree, setDegree] = useState('')
  const [field, setField] = useState('')
  const [funding, setFunding] = useState('')
  const [deadline, setDeadline] = useState('')
  const [sort, setSort] = useState('title')
  const [page, setPage] = useState(0)

  const all = store.listPublishedScholarships()
  const countries = [...new Set(all.flatMap((item) => item.destinationCountries))]
  const fields = [...new Set(all.flatMap((item) => item.fields))]

  const filtered = useMemo(() => {
    const query = q.toLowerCase()
    let rows = all.filter((item) => {
      const blob = `${item.title} ${item.provider} ${item.fields.join(' ')} ${item.destinationCountries.join(' ')}`.toLowerCase()
      if (query && !blob.includes(query)) return false
      if (status && item.openStatus !== status) return false
      if (destination && !item.destinationCountries.includes(destination)) return false
      if (degree && !item.supportedDegrees.includes(degree as 'masters' | 'phd')) return false
      if (field && !item.fields.some((f) => f.toLowerCase().includes(field.toLowerCase()))) return false
      if (funding && item.fundingType !== funding) return false
      if (deadline === 'known' && !item.deadlineAt) return false
      if (deadline === 'unknown' && item.deadlineAt) return false
      return true
    })
    rows = [...rows].sort((a, b) => {
      if (sort === 'deadline') return String(a.deadlineAt).localeCompare(String(b.deadlineAt))
      return a.title.localeCompare(b.title)
    })
    return rows
  }, [all, q, status, destination, degree, field, funding, deadline, sort])

  const slice = filtered.slice(page * PAGE, page * PAGE + PAGE)
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE))

  return (
    <div className="page">
      <h1>Scholarship directory</h1>
      <p className="muted">
        {filtered.length} result{filtered.length === 1 ? '' : 's'}. Catalog examples include official
        source URLs; unknown deadlines stay unknown.
      </p>
      <div className="card grid cols-3">
        <label>
          Search title, provider, field, country
          <input value={q} onChange={(e) => { setQ(e.target.value); setPage(0) }} />
        </label>
        <label>
          Status
          <select value={status} onChange={(e) => { setStatus(e.target.value as OpenStatus | ''); setPage(0) }}>
            <option value="">Any</option>
            <option value="open">Open</option>
            <option value="closed">Closed</option>
            <option value="unknown">Unknown</option>
          </select>
        </label>
        <label>
          Destination
          <select value={destination} onChange={(e) => { setDestination(e.target.value); setPage(0) }}>
            <option value="">Any</option>
            {countries.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
        <label>
          Degree
          <select value={degree} onChange={(e) => { setDegree(e.target.value); setPage(0) }}>
            <option value="">Any</option>
            <option value="masters">Master’s</option>
            <option value="phd">PhD</option>
          </select>
        </label>
        <label>
          Field
          <select value={field} onChange={(e) => { setField(e.target.value); setPage(0) }}>
            <option value="">Any</option>
            {fields.map((f) => (
              <option key={f}>{f}</option>
            ))}
          </select>
        </label>
        <label>
          Funding
          <select value={funding} onChange={(e) => { setFunding(e.target.value); setPage(0) }}>
            <option value="">Any</option>
            <option value="full">Full</option>
            <option value="partial">Partial</option>
            <option value="unknown">Unknown</option>
          </select>
        </label>
        <label>
          Deadline
          <select value={deadline} onChange={(e) => { setDeadline(e.target.value); setPage(0) }}>
            <option value="">Any</option>
            <option value="known">Date stored</option>
            <option value="unknown">Unknown</option>
          </select>
        </label>
        <label>
          Sort
          <select value={sort} onChange={(e) => setSort(e.target.value)}>
            <option value="title">Title</option>
            <option value="deadline">Deadline</option>
          </select>
        </label>
        <button
          className="btn secondary"
          type="button"
          onClick={() => {
            setQ(''); setStatus(''); setDestination(''); setDegree(''); setField(''); setFunding(''); setDeadline(''); setPage(0)
          }}
        >
          {t.actions.clear}
        </button>
      </div>
      {slice.length === 0 ? (
        <p className="alert">No listings match these filters.</p>
      ) : (
        <div className="grid cols-2" style={{ marginTop: '1rem' }}>
          {slice.map((item) => (
            <ScholarshipCard key={item.id} scholarship={item} />
          ))}
        </div>
      )}
      <div className="cluster" style={{ marginTop: '1rem' }}>
        <button className="btn secondary" type="button" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
          Previous
        </button>
        <span>
          Page {page + 1} / {pages}
        </span>
        <button className="btn secondary" type="button" disabled={page + 1 >= pages} onClick={() => setPage((p) => p + 1)}>
          Next
        </button>
      </div>
    </div>
  )
}
