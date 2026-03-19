import { useCallback } from 'react'
import { Routes, Route } from 'react-router-dom'
import { PitVoxPartnerProvider } from '@pitvox/partner-react'
import { generateClient } from 'aws-amplify/api'
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

const client = generateClient()

function AppRoutes() {
  const { user } = useAuth()

  // ──────────────────────────────────────────────────────────────
  // Competition registration callbacks (power mode).
  // These call AppSync mutations that proxy to pitvox-api via
  // HTTP data source resolvers. The partner API key stays
  // server-side, and the user's Steam ID is extracted from the
  // Cognito token — not from client input.
  // ──────────────────────────────────────────────────────────────
  const handleRegister = useCallback(async (competitionId, driverData) => {
    const { data, errors } = await client.graphql({
      query: /* GraphQL */ `
        mutation RegisterForCompetition(
          $competitionId: String!
          $displayName: String!
          $avatarUrl: String
          $discordUsername: String
          $experience: String
          $comments: String
        ) {
          registerForCompetition(
            competitionId: $competitionId
            displayName: $displayName
            avatarUrl: $avatarUrl
            discordUsername: $discordUsername
            experience: $experience
            comments: $comments
          ) {
            success
            id
            error
          }
        }
      `,
      variables: {
        competitionId,
        displayName: user?.displayName || 'Unknown',
        avatarUrl: user?.avatarUrl || undefined,
        ...driverData,
      },
    })

    if (errors?.length) throw new Error(errors[0].message)
    const result = data?.registerForCompetition
    if (!result?.success) throw new Error(result?.error || 'Registration failed')
    return result
  }, [user])

  const handleWithdraw = useCallback(async (competitionId) => {
    const { data, errors } = await client.graphql({
      query: /* GraphQL */ `
        mutation WithdrawFromCompetition($competitionId: String!) {
          withdrawFromCompetition(competitionId: $competitionId) {
            success
            id
            error
          }
        }
      `,
      variables: { competitionId },
    })

    if (errors?.length) throw new Error(errors[0].message)
    const result = data?.withdrawFromCompetition
    if (!result?.success) throw new Error(result?.error || 'Withdrawal failed')
    return result
  }, [])

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
