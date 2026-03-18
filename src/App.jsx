import { useCallback } from 'react'
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

/**
 * Get the competition proxy Lambda URL from Amplify outputs.
 */
function getProxyUrl() {
  return window.amplifyOutputs?.custom?.competitionProxyUrl || null
}

function AppRoutes() {
  const { user, getAccessToken } = useAuth()

  // ──────────────────────────────────────────────────────────────
  // Competition registration callbacks (power mode).
  // These proxy through the competition-proxy Lambda so the
  // partner API key stays server-side. The Lambda validates the
  // Cognito access token and enforces that users can only
  // register/withdraw themselves.
  // ──────────────────────────────────────────────────────────────
  const handleRegister = useCallback(async (competitionId, driverData) => {
    const proxyUrl = getProxyUrl()
    if (!proxyUrl) throw new Error('Competition proxy URL not found in Amplify outputs')

    const accessToken = getAccessToken()
    if (!accessToken) throw new Error('Not authenticated')

    const res = await fetch(
      `${proxyUrl}?action=register&competitionId=${encodeURIComponent(competitionId)}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          display_name: user?.displayName || 'Unknown',
          avatar_url: user?.avatarUrl || undefined,
          ...driverData,
        }),
      }
    )

    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.error || `Registration failed (${res.status})`)
    }

    return res.json()
  }, [user, getAccessToken])

  const handleWithdraw = useCallback(async (competitionId, steamId) => {
    const proxyUrl = getProxyUrl()
    if (!proxyUrl) throw new Error('Competition proxy URL not found in Amplify outputs')

    const accessToken = getAccessToken()
    if (!accessToken) throw new Error('Not authenticated')

    const res = await fetch(
      `${proxyUrl}?action=withdraw&competitionId=${encodeURIComponent(competitionId)}&steamId=${encodeURIComponent(steamId)}`,
      {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${accessToken}` },
      }
    )

    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.error || `Withdrawal failed (${res.status})`)
    }

    return res.json()
  }, [getAccessToken])

  return (
    // ──────────────────────────────────────────────────────────────
    // TODO: Replace "your-slug" with your PitVox partner slug.
    //       You can get your slug from your PitVox partner dashboard.
    // ──────────────────────────────────────────────────────────────
    <PitVoxPartnerProvider
      partnerSlug="your-slug"
      getSteamId={() => user?.steamId || null}
      onRegister={handleRegister}
      onWithdraw={handleWithdraw}
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
