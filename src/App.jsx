import { Routes, Route } from 'react-router-dom'
import { PitVoxPartnerProvider } from '@pitvox/partner-react'
import { AuthProvider } from './providers/AuthProvider'
import Layout from './components/Layout.jsx'
import Home from './pages/Home.jsx'
import Competitions from './pages/Competitions.jsx'
import Leaderboards from './pages/Leaderboards.jsx'
import Dashboard from './pages/Dashboard.jsx'
import { AuthComplete } from './pages/auth/Complete.jsx'
import { AuthError } from './pages/auth/Error.jsx'
import { ProtectedRoute } from './components/ProtectedRoute.jsx'
import { useAuth } from './hooks/useAuth.js'

function AppRoutes() {
  const { user } = useAuth()

  return (
    // ──────────────────────────────────────────────────────────────
    // TODO: Replace "your-slug" with your PitVox partner slug.
    //       You can get your slug from your PitVox partner dashboard.
    // ──────────────────────────────────────────────────────────────
    <PitVoxPartnerProvider
      partnerSlug="your-slug"
      getSteamId={() => user?.steamId || null}
    >
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Home />} />
          <Route path="competitions" element={<Competitions />} />
          <Route path="leaderboards" element={<Leaderboards />} />
          <Route
            path="dashboard"
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            }
          />
        </Route>
        <Route path="auth/complete" element={<AuthComplete />} />
        <Route path="auth/error" element={<AuthError />} />
      </Routes>
    </PitVoxPartnerProvider>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  )
}
