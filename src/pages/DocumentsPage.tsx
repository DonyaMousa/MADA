import { useState } from 'react'
import { useMada } from '../app/state'
import type { DocumentKind } from '../domain/types'
import { StoreError } from '../data/store'

export function DocumentsPage() {
  const { store, refresh, t } = useMada()
  const docs = store.listDocuments()
  const apps = store.listApplications()
  const [error, setError] = useState('')

  return (
    <div className="page">
      <h1>Private document vault</h1>
      <p className="muted">
        Files are private to your account. Communities cannot see them. Deleting a file also drops extracted
        text.
      </p>
      {error ? <p className="alert error">{error}</p> : null}
      <form
        className="card cluster"
        onSubmit={(e) => {
          e.preventDefault()
          const form = new FormData(e.currentTarget)
          const file = form.get('file') as File | null
          if (!file) return
          try {
            void file.text().then((text) => {
              store.uploadDocument({
                kind: String(form.get('kind')) as DocumentKind,
                file: { name: file.name, type: file.type, size: file.size, text, blob: file },
              })
              refresh()
            })
          } catch (err) {
            setError(err instanceof StoreError ? err.message : 'Upload failed')
          }
        }}
      >
        <label>
          Kind
          <select name="kind">
            <option value="cv">CV</option>
            <option value="transcript">Transcript</option>
            <option value="certificate">Certificate</option>
            <option value="language_result">Language result</option>
            <option value="recommendation">Recommendation</option>
            <option value="other">Other</option>
          </select>
        </label>
        <label>
          File
          <input name="file" type="file" required />
        </label>
        <button className="btn" type="submit">
          {t.actions.upload}
        </button>
      </form>
      {docs.length === 0 ? <p className="alert">Vault is empty.</p> : null}
      {docs.map((doc) => (
        <article className="card" key={doc.id} style={{ marginTop: '0.7rem' }}>
          <h2>{doc.originalName}</h2>
          <p className="muted">
            {doc.kind} · {doc.safeName} · {doc.byteSize} bytes
          </p>
          <p>
            Attached to:{' '}
            {store.applicationsForDocument(doc.id).map((appId) => {
              const app = apps.find((a) => a.id === appId)
              const title = app ? store.getScholarship(app.scholarshipId)?.title : appId
              return <span key={appId}>{title}; </span>
            }) || 'none'}
          </p>
          <form
            className="cluster"
            onSubmit={(e) => {
              e.preventDefault()
              const name = String(new FormData(e.currentTarget).get('name'))
              store.renameDocument(doc.id, name)
              refresh()
            }}
          >
            <input name="name" defaultValue={doc.originalName} />
            <button className="btn secondary" type="submit">
              Rename
            </button>
          </form>
          <label>
            Attach to application
            <select
              onChange={(e) => {
                if (e.target.value) {
                  store.attachDocument(doc.id, e.target.value)
                  refresh()
                }
              }}
              defaultValue=""
            >
              <option value="">Choose</option>
              {apps.map((app) => (
                <option key={app.id} value={app.id}>
                  {store.getScholarship(app.scholarshipId)?.title}
                </option>
              ))}
            </select>
          </label>
          <button className="btn danger" type="button" onClick={() => { store.deleteDocument(doc.id); refresh() }}>
            {t.actions.delete}
          </button>
        </article>
      ))}
    </div>
  )
}
