import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useMada } from '../app/state'
import { StoreError } from '../data/store'

export function SignUpPage() {
  const { store, refresh, t } = useMada()
  const navigate = useNavigate()
  const [error, setError] = useState('')
  return (
    <div className="page">
      <h1>{t.nav.signUp}</h1>
      <form
        className="card grid"
        onSubmit={async (e) => {
          e.preventDefault()
          const form = new FormData(e.currentTarget)
          try {
            await store.signUp(String(form.get('email')), String(form.get('password')))
            refresh()
            navigate('/profile')
          } catch (err) {
            setError(err instanceof StoreError ? err.message : 'Could not create account.')
          }
        }}
      >
        {error ? <p className="alert error">{error}</p> : null}
        <label>
          {t.auth.email}
          <input name="email" type="email" autoComplete="email" required />
        </label>
        <label>
          {t.auth.password}
          <input name="password" type="password" autoComplete="new-password" required minLength={8} />
        </label>
        <button className="btn" type="submit">
          {t.nav.signUp}
        </button>
        <Link to="/signin">{t.nav.signIn}</Link>
      </form>
    </div>
  )
}

export function SignInPage() {
  const { store, refresh, t } = useMada()
  const navigate = useNavigate()
  const [error, setError] = useState('')
  return (
    <div className="page">
      <h1>{t.nav.signIn}</h1>
      <form
        className="card grid"
        onSubmit={async (e) => {
          e.preventDefault()
          const form = new FormData(e.currentTarget)
          try {
            await store.signIn(String(form.get('email')), String(form.get('password')))
            refresh()
            navigate('/matches')
          } catch (err) {
            setError(err instanceof StoreError ? err.message : 'Could not sign in.')
          }
        }}
      >
        {error ? <p className="alert error">{error}</p> : null}
        <label>
          {t.auth.email}
          <input name="email" type="email" autoComplete="email" required />
        </label>
        <label>
          {t.auth.password}
          <input name="password" type="password" autoComplete="current-password" required />
        </label>
        <button className="btn" type="submit">
          {t.nav.signIn}
        </button>
        <Link to="/reset">{t.auth.reset}</Link>
      </form>
    </div>
  )
}

export function ResetPage() {
  const { store, refresh, t } = useMada()
  const [done, setDone] = useState(false)
  return (
    <div className="page">
      <h1>{t.auth.reset}</h1>
      <form
        className="card grid"
        onSubmit={async (e) => {
          e.preventDefault()
          const form = new FormData(e.currentTarget)
          await store.resetPassword(String(form.get('email')), String(form.get('password')))
          refresh()
          setDone(true)
        }}
      >
        {done ? (
          <p className="alert success">
            If that email exists locally, the password was updated. Hosted Supabase reset email is
            unconfigured unless you add SMTP in the project.
          </p>
        ) : null}
        <label>
          {t.auth.email}
          <input name="email" type="email" required />
        </label>
        <label>
          New password
          <input name="password" type="password" minLength={8} required />
        </label>
        <button className="btn" type="submit">
          {t.auth.reset}
        </button>
      </form>
    </div>
  )
}

export function AccountPage() {
  const { store, session, refresh, t } = useMada()
  const navigate = useNavigate()
  if (!session) return null
  const pref = store.reminders.find((item) => item.userId === session.userId)
  return (
    <div className="page">
      <h1>{t.nav.account}</h1>
      <p>{session.email}</p>
      <section className="card">
        <h2>Reminder preferences</h2>
        {pref ? (
          <form
            className="grid"
            onSubmit={(e) => {
              e.preventDefault()
              const form = new FormData(e.currentTarget)
              pref.inApp = form.get('inApp') === 'on'
              pref.email = form.get('emailOn') === 'on'
              pref.timezone = String(form.get('timezone'))
              refresh()
            }}
          >
            <label>
              <input name="inApp" type="checkbox" defaultChecked={pref.inApp} /> In-app
            </label>
            <label>
              <input name="emailOn" type="checkbox" defaultChecked={pref.email} /> Email (requires SMTP)
            </label>
            <label>
              Timezone
              <input name="timezone" defaultValue={pref.timezone} />
            </label>
            <button className="btn" type="submit">
              Save preferences
            </button>
          </form>
        ) : null}
        <p className="muted">
          Email delivery: {store.deliveries.some((d) => d.status === 'sent') ? 'has sent logs' : 'unconfigured locally unless SMTP is set on the API server.'}
        </p>
      </section>
      <Link to="/notifications">{t.nav.notifications}</Link>
      <div style={{ marginTop: '2rem' }}>
        <button
          className="btn danger"
          type="button"
          onClick={() => {
            if (confirm('Delete account, private files, and extracted text?')) {
              store.deleteAccount(session.userId)
              refresh()
              navigate('/')
            }
          }}
        >
          {t.auth.deleteAccount}
        </button>
      </div>
    </div>
  )
}

export function NotificationsPage() {
  const { store, refresh } = useMada()
  const items = store.listNotifications()
  return (
    <div className="page">
      <h1>Notifications</h1>
      {items.length === 0 ? <p className="alert">No notifications yet.</p> : null}
      {items.map((item) => (
        <article className="card" key={item.id} style={{ marginBottom: '0.6rem' }}>
          <h3>{item.title}</h3>
          <p>{item.body}</p>
          {item.payload.oldValue ? (
            <p className="muted">
              {item.payload.field}: {item.payload.oldValue} → {item.payload.newValue}
            </p>
          ) : null}
          <button
            className="btn secondary"
            type="button"
            onClick={() => {
              item.read = true
              refresh()
            }}
          >
            Mark read
          </button>
        </article>
      ))}
    </div>
  )
}
