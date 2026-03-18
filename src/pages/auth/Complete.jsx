/**
 * Auth completion page.
 *
 * Handles the redirect from Steam auth Lambda with tokens in the URL.
 * Extracts tokens, stores them via AuthProvider, and redirects to dashboard.
 */

import { useEffect, useMemo } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'

export function AuthComplete() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { setSteamTokens } = useAuth()

  const hasTokens = useMemo(() => {
    const idToken = searchParams.get('idToken')
    const accessToken = searchParams.get('accessToken')
    return !!(idToken && accessToken)
  }, [searchParams])

  useEffect(() => {
    if (!hasTokens) return

    const idToken = searchParams.get('idToken')
    const accessToken = searchParams.get('accessToken')
    const refreshToken = searchParams.get('refreshToken')
    const expiresIn = searchParams.get('expiresIn')
    const avatarUrl = searchParams.get('avatarUrl')

    setSteamTokens({
      idToken,
      accessToken,
      refreshToken,
      expiresIn: parseInt(expiresIn, 10) || 3600,
      avatarUrl: avatarUrl || null,
    })

    const returnTo = sessionStorage.getItem('authReturnTo') || '/dashboard'
    sessionStorage.removeItem('authReturnTo')
    navigate(returnTo, { replace: true })
  }, [hasTokens, searchParams, navigate, setSteamTokens])

  if (!hasTokens) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-center">
        <h1 className="text-2xl font-bold mb-4">Authentication Failed</h1>
        <p className="text-gray-400 mb-6">Missing authentication tokens. Please try signing in again.</p>
        <a href="/" className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-500 transition-colors">
          Return Home
        </a>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] text-center">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500 mb-4" />
      <h1 className="text-2xl font-bold">Completing sign in...</h1>
      <p className="text-gray-400 mt-2">Please wait while we verify your Steam account.</p>
    </div>
  )
}
