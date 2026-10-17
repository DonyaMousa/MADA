import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'
import { ArchitectureMotif, GlobeMark } from './Brand'
import { useMada } from '../app/state'

export function Layout() {
  const { t, locale, setLocale, theme, setTheme, dir, session, store, refresh } = useMada()
  const navigate = useNavigate()

  return (
    <div className="shell" data-theme={theme} dir={dir} lang={locale}>
      <a className="skip" href="#main">
        Skip to content
      </a>
      <header className="nav">
        <div className="nav-inner">
          <Link className="brand" to="/">
            <GlobeMark />
            <span>
              <strong className="display">{t.brand}</strong>
              <small>{t.tagline}</small>
            </span>
          </Link>
          <nav className="nav-links" aria-label="Primary">
            <NavLink to="/scholarships">{t.nav.scholarships}</NavLink>
            <NavLink to="/search">{t.nav.search}</NavLink>
            {session ? <NavLink to="/matches">{t.nav.matches}</NavLink> : null}
            {session ? <NavLink to="/applications">{t.nav.applications}</NavLink> : null}
            {session ? <NavLink to="/documents">{t.nav.documents}</NavLink> : null}
            {session ? <NavLink to="/letters">{t.nav.letters}</NavLink> : null}
            <NavLink to="/resources">{t.nav.resources}</NavLink>
            <NavLink to="/help">{t.nav.help}</NavLink>
            <button type="button" onClick={() => setLocale(locale === 'en' ? 'ar' : 'en')}>
              {locale === 'en' ? 'العربية' : 'English'}
            </button>
            <button type="button" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
              {theme === 'dark' ? 'Light' : 'Dark'}
            </button>
            {session ? (
              <>
                <NavLink to="/account">{t.nav.account}</NavLink>
                <button
                  type="button"
                  onClick={() => {
                    store.signOut()
                    refresh()
                    navigate('/')
                  }}
                >
                  {t.nav.signOut}
                </button>
              </>
            ) : (
              <>
                <NavLink to="/signin">{t.nav.signIn}</NavLink>
                <NavLink className="btn" to="/signup">
                  {t.nav.signUp}
                </NavLink>
              </>
            )}
          </nav>
        </div>
      </header>
      <div style={{ position: 'relative' }}>
        <ArchitectureMotif />
        <main id="main">
          <Outlet />
        </main>
      </div>
      <footer className="footer">
        <div className="footer-inner" style={{ padding: '1.5rem 0' }}>
          <div className="cluster">
            <Link to="/about">{t.nav.about}</Link>
            <Link to="/contact">{t.nav.contact}</Link>
            <Link to="/privacy">{t.nav.privacy}</Link>
            <Link to="/terms">{t.nav.terms}</Link>
            <Link to="/help">{t.nav.help}</Link>
            <Link to="/providers/propose">{t.nav.propose}</Link>
            {store.profile(session?.userId ?? '')?.role === 'admin' ? (
              <Link to="/admin">{t.nav.admin}</Link>
            ) : null}
          </div>
          <p className="muted">{t.footer.note}</p>
        </div>
      </footer>
    </div>
  )
}

export function RequireAuth({ children }: { children: React.ReactNode }) {
  const { session } = useMada()
  if (!session) {
    return (
      <div className="page">
        <div className="alert">
          Sign in to use this workspace.{' '}
          <Link to="/signin">Sign in</Link>
        </div>
      </div>
    )
  }
  return <>{children}</>
}
