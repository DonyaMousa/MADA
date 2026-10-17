import { Link, Route, Routes } from 'react-router-dom'
import { Layout, RequireAuth } from '../components/Layout'
import { HomePage } from '../pages/Home'
import { ScholarshipsPage } from '../pages/Scholarships'
import { ScholarshipDetailPage } from '../pages/ScholarshipDetail'
import { SearchPage } from '../pages/SearchPage'
import { SignInPage, SignUpPage, ResetPage, AccountPage, NotificationsPage } from '../pages/AuthPages'
import { ProfilePage } from '../pages/ProfilePage'
import { MatchesPage } from '../pages/MatchesPage'
import { ApplicationsBoardPage, ApplicationDetailPage } from '../pages/ApplicationsPages'
import { DocumentsPage } from '../pages/DocumentsPage'
import { useMada } from './state'

function NotFoundPage() {
  const { locale } = useMada()
  return (
    <div className="page">
      <h1>{locale === 'ar' ? 'الصفحة غير متاحة' : 'Page not available'}</h1>
      <p>{locale === 'ar' ? 'هذه الصفحة غير متاحة في النسخة الحالية.' : 'This page is not available in the current version.'}</p>
      <Link to="/">{locale === 'ar' ? 'العودة للرئيسية' : 'Return to the homepage'}</Link>
    </div>
  )
}

export function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<HomePage />} />
        <Route path="scholarships" element={<ScholarshipsPage />} />
        <Route path="scholarships/:slug" element={<ScholarshipDetailPage />} />
        <Route path="search" element={<SearchPage />} />
        <Route path="signin" element={<SignInPage />} />
        <Route path="signup" element={<SignUpPage />} />
        <Route path="reset" element={<ResetPage />} />
        <Route path="profile" element={<RequireAuth><ProfilePage /></RequireAuth>} />
        <Route path="matches" element={<RequireAuth><MatchesPage /></RequireAuth>} />
        <Route path="applications" element={<RequireAuth><ApplicationsBoardPage /></RequireAuth>} />
        <Route path="applications/:id" element={<RequireAuth><ApplicationDetailPage /></RequireAuth>} />
        <Route path="documents" element={<RequireAuth><DocumentsPage /></RequireAuth>} />
        <Route path="account" element={<RequireAuth><AccountPage /></RequireAuth>} />
        <Route path="notifications" element={<RequireAuth><NotificationsPage /></RequireAuth>} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  )
}
