import { Link } from 'react-router-dom'
import { useMada } from '../app/state'
import { ScholarshipCard } from '../components/ScholarshipCard'

export function HomePage() {
  const { t, store } = useMada()
  const selected = store.listPublishedScholarships().slice(0, 3)

  return (
    <div>
      <section className="hero">
        <div className="hero-inner">
          <p className="badge gold">Egyptian Master’s & PhD applicants</p>
          <h1 className="display" style={{ fontSize: 'clamp(2rem, 5vw, 3.4rem)', maxWidth: '18ch' }}>
            {t.home.heroTitle}
          </h1>
          <p style={{ maxWidth: '62ch' }}>{t.home.heroBody}</p>
          <div className="cluster">
            <Link className="btn" to="/scholarships">
              {t.actions.explore}
            </Link>
            <Link className="btn secondary" to="/signup">
              {t.actions.createProfile}
            </Link>
          </div>
        </div>
      </section>
      <div className="page" style={{ paddingTop: 0 }}>
        <form className="card cluster" action="/search" method="get">
          <label style={{ flex: 1 }}>
            Natural-language search
            <input name="q" placeholder="fully funded computer science Master’s programs in Germany" />
          </label>
          <button className="btn" type="submit">
            {t.actions.search}
          </button>
        </form>
        <p className="muted">{t.home.exampleNote}</p>
        <div className="grid cols-3" style={{ marginTop: '1rem' }}>
          {selected.map((item) => (
            <ScholarshipCard key={item.id} scholarship={item} />
          ))}
        </div>
        <h2>{t.home.featuresTitle}</h2>
        <div className="grid cols-3">
          {Object.values(t.features).map((text) => (
            <article className="card" key={text}>
              <p>{text}</p>
            </article>
          ))}
        </div>
        <h2>{t.home.howTitle}</h2>
        <ol className="grid cols-2">
          {[t.home.step1, t.home.step2, t.home.step3, t.home.step4].map((step, index) => (
            <li className="card" key={step}>
              <strong>0{index + 1}</strong>
              <p>{step}</p>
            </li>
          ))}
        </ol>
        <h2>{t.home.selected}</h2>
        <div className="grid cols-3">
          {store.listPublishedScholarships().slice(0, 6).map((item) => (
            <ScholarshipCard key={item.id} scholarship={item} />
          ))}
        </div>
        <section className="card" style={{ marginTop: '1.5rem' }}>
          <h2>{t.home.privacyTitle}</h2>
          <p>{t.home.privacyBody}</p>
          <Link to="/privacy">{t.nav.privacy}</Link>
        </section>
        <section className="card" style={{ marginTop: '1rem' }}>
          <h2>FAQ</h2>
          <p>
            <strong>Does Mada submit applications?</strong> No. You complete them on the official site.
            Opening Apply never marks a record as submitted.
          </p>
          <p>
            <strong>Are these all live awards?</strong> No. Seed listings are labeled development catalog
            examples with official source URLs.
          </p>
        </section>
        <div className="cluster" style={{ marginTop: '1.5rem' }}>
          <Link className="btn" to="/signup">
            {t.actions.createProfile}
          </Link>
          <Link className="btn secondary" to="/resources">
            {t.nav.resources}
          </Link>
        </div>
      </div>
    </div>
  )
}
