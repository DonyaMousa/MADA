import { useState } from 'react'
import { useMada } from '../app/state'
import { profileCompleteness } from '../domain/profileCompleteness'
import { extractCvSuggestions, type CvSuggestion } from '../lib/cvExtract'
import type { Degree, FundingType } from '../domain/types'

export function ProfilePage() {
  const { store, session, refresh, t } = useMada()
  if (!session) return null
  const profile = store.getProfile(session.userId)
  const completeness = profileCompleteness(profile)
  const [suggestions, setSuggestions] = useState<CvSuggestion[]>([])
  const [message, setMessage] = useState('')

  return (
    <div className="page">
      <h1>{t.profile.title}</h1>
      <p>
        {t.profile.completeness}: {completeness.percent}% ({completeness.filled}/{completeness.total})
      </p>
      <p className="muted">{t.profile.cvOptional}</p>
      <form
        className="card grid cols-2"
        onSubmit={(e) => {
          e.preventDefault()
          const form = new FormData(e.currentTarget)
          const destinations = String(form.get('destinations'))
            .split(',')
            .map((v) => v.trim())
            .filter(Boolean)
          const testsRaw = String(form.get('languageTests')).trim()
          store.updateProfile(profile.id, {
            displayName: String(form.get('displayName')),
            citizenship: String(form.get('citizenship')),
            residenceCountry: String(form.get('residenceCountry')),
            currentDegree: String(form.get('currentDegree')),
            institution: String(form.get('institution')),
            fieldOfStudy: String(form.get('fieldOfStudy')),
            gpa: form.get('gpa') ? Number(form.get('gpa')) : null,
            gpaScale: form.get('gpaScale') ? Number(form.get('gpaScale')) : null,
            graduationYear: form.get('graduationYear') ? Number(form.get('graduationYear')) : null,
            intendedDegree: String(form.get('intendedDegree')) as Degree | '',
            researchInterests: String(form.get('researchInterests')),
            destinationPreferences: destinations,
            fundingNeed: String(form.get('fundingNeed')) as FundingType | '',
            languageTests: testsRaw
              ? testsRaw.split(',').map((part) => {
                  const [name, score] = part.split(':').map((s) => s.trim())
                  return { name, score: Number(score) }
                })
              : [],
            relevantExperience: String(form.get('relevantExperience')),
            workExperience: String(form.get('workExperience')),
            experienceYears: form.get('experienceYears') ? Number(form.get('experienceYears')) : null,
          })
          refresh()
          setMessage('Profile saved. Skipped fields stay empty until you return.')
        }}
      >
        {message ? <p className="alert success" style={{ gridColumn: '1 / -1' }}>{message}</p> : null}
        <label>Display name<input name="displayName" defaultValue={profile.displayName} /></label>
        <label>Citizenship<input name="citizenship" defaultValue={profile.citizenship} placeholder="Egypt" /></label>
        <label>Residence<input name="residenceCountry" defaultValue={profile.residenceCountry} /></label>
        <label>Current degree<input name="currentDegree" defaultValue={profile.currentDegree} /></label>
        <label>Institution<input name="institution" defaultValue={profile.institution} /></label>
        <label>Field<input name="fieldOfStudy" defaultValue={profile.fieldOfStudy} /></label>
        <label>GPA<input name="gpa" type="number" step="0.01" defaultValue={profile.gpa ?? ''} /></label>
        <label>GPA scale<input name="gpaScale" type="number" step="0.01" defaultValue={profile.gpaScale ?? ''} /></label>
        <label>Graduation year<input name="graduationYear" type="number" defaultValue={profile.graduationYear ?? ''} /></label>
        <label>
          Intended degree
          <select name="intendedDegree" defaultValue={profile.intendedDegree}>
            <option value="">Skip</option>
            <option value="masters">Master’s</option>
            <option value="phd">PhD</option>
            <option value="either">Either</option>
          </select>
        </label>
        <label>
          Funding need
          <select name="fundingNeed" defaultValue={profile.fundingNeed}>
            <option value="">Skip</option>
            <option value="full">Full</option>
            <option value="partial">Partial</option>
            <option value="any">Any</option>
          </select>
        </label>
        <label>Destinations (comma separated)<input name="destinations" defaultValue={profile.destinationPreferences.join(', ')} /></label>
        <label>Language tests (IELTS:7)<input name="languageTests" defaultValue={profile.languageTests.map((t) => `${t.name}:${t.score}`).join(', ')} /></label>
        <label>Experience years<input name="experienceYears" type="number" defaultValue={profile.experienceYears ?? ''} /></label>
        <label style={{ gridColumn: '1 / -1' }}>
          Research interests
          <textarea name="researchInterests" defaultValue={profile.researchInterests} />
        </label>
        <label style={{ gridColumn: '1 / -1' }}>
          Relevant experience
          <textarea name="relevantExperience" defaultValue={profile.relevantExperience} />
        </label>
        <label style={{ gridColumn: '1 / -1' }}>
          Optional work experience
          <textarea name="workExperience" defaultValue={profile.workExperience} />
        </label>
        <div className="cluster">
          <button className="btn" type="submit">Save profile</button>
          <button className="btn secondary" type="submit">{t.actions.skip}</button>
        </div>
      </form>
      <section className="card" style={{ marginTop: '1rem' }}>
        <h2>Optional English CV text</h2>
        <p className="muted">Paste text from a PDF in this development build. Suggestions are not saved until you confirm.</p>
        <textarea id="cvtext" placeholder="Paste CV text" />
        <button
          className="btn secondary"
          type="button"
          onClick={() => {
            const text = (document.getElementById('cvtext') as HTMLTextAreaElement).value
            setSuggestions(extractCvSuggestions(text))
          }}
        >
          Extract suggestions
        </button>
        {suggestions.map((item) => (
          <div className="cluster" key={item.field} style={{ marginTop: '0.5rem' }}>
            <span>
              {item.field}: {item.value} (confidence {item.confidence}) — “{item.sourceText}”
            </span>
            <button
              className="btn"
              type="button"
              onClick={() => {
                if (item.field === 'gpa' || item.field === 'gpaScale') {
                  store.updateProfile(profile.id, { [item.field]: Number(item.value) })
                } else if (item.field === 'languageTests') {
                  store.updateProfile(profile.id, { languageTests: [JSON.parse(item.value)] })
                } else {
                  store.updateProfile(profile.id, { [item.field]: item.value })
                }
                refresh()
              }}
            >
              {t.actions.confirm}
            </button>
            <button className="btn ghost" type="button" onClick={() => setSuggestions((s) => s.filter((x) => x !== item))}>
              {t.actions.reject}
            </button>
          </div>
        ))}
      </section>
    </div>
  )
}
