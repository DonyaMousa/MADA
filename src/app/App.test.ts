import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createElement } from 'react'
import { renderToString } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { App } from './App'
import { AppStateProvider } from './state'
import { StoreError, store } from '../data/store'

beforeEach(() => {
  const values = new Map<string, string>()
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value) },
    removeItem: (key: string) => { values.delete(key) },
  })
  store.session = null
})

function renderPage(path: string, locale: 'en' | 'ar') {
  localStorage.setItem('mada.locale', locale)
  return renderToString(
    createElement(MemoryRouter, { initialEntries: [path] },
      createElement(AppStateProvider, null, createElement(App))),
  )
}

describe('application startup', () => {
  for (const locale of ['en', 'ar'] as const) {
    it(`renders the homepage in ${locale}`, () => {
      const html = renderPage('/', locale)
      expect(html).toContain(locale === 'ar' ? 'dir="rtl"' : 'dir="ltr"')
      expect(html).toContain('class="hero"')
      expect(html).toContain('href="/scholarships"')
    })

    it(`opens the scholarship directory in ${locale}`, () => {
      expect(renderPage('/scholarships', locale)).toContain('Scholarship directory')
    })

    it(`opens a scholarship detail page in ${locale}`, () => {
      expect(renderPage('/scholarships/chevening-scholarships', locale)).toContain('Chevening Scholarships')
    })

    it(`protects the signed-out workspace in ${locale}`, () => {
      expect(renderPage('/applications', locale)).toContain('href="/signin"')
    })
  }

  it('preserves the store error code', () => {
    const error = new StoreError('Sign in required.', 'auth')
    expect(error).toBeInstanceOf(Error)
    expect(error.message).toBe('Sign in required.')
    expect(error.code).toBe('auth')
  })
})
