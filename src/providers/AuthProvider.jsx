/**
 * Authentication provider.
 *
 * Manages Steam authentication state via Amplify Cognito.
 * Users authenticate via Steam OpenID, which creates/updates a Cognito user.
 * Tokens are stored in localStorage and synced to Amplify's expected format.
 */

import { createContext, useCallback, useEffect, useState } from 'react'
import { signOut, fetchAuthSession } from 'aws-amplify/auth'

export const AuthContext = createContext(null)

// Storage keys
const TOKEN_STORAGE_KEY = 'partner_auth_tokens'
const AVATAR_STORAGE_KEY = 'partner_avatar_url'

/**
 * Parse JWT payload
 */
function parseJwt(token) {
  try {
    const base64Url = token.split('.')[1]
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/')
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    )
    return JSON.parse(jsonPayload)
  } catch {
    return {}
  }
}

/**
 * Get Amplify's storage key prefix
 */
function getAmplifyKeyPrefix() {
  const outputs = window.amplifyOutputs
  if (!outputs?.auth) return null
  const { user_pool_client_id: clientId } = outputs.auth
  return `CognitoIdentityServiceProvider.${clientId}`
}

/**
 * Sync our tokens to Amplify's expected localStorage format
 */
function syncTokensToAmplify(tokens) {
  const prefix = getAmplifyKeyPrefix()
  if (!prefix) return

  const payload = parseJwt(tokens.idToken)
  const username = payload['cognito:username'] || payload.sub

  localStorage.setItem(`${prefix}.${username}.idToken`, tokens.idToken)
  localStorage.setItem(`${prefix}.${username}.accessToken`, tokens.accessToken)
  if (tokens.refreshToken) {
    localStorage.setItem(`${prefix}.${username}.refreshToken`, tokens.refreshToken)
  }
  localStorage.setItem(`${prefix}.LastAuthUser`, username)
}

/**
 * Extract user info from JWT payload
 */
function extractUserFromPayload(payload, avatarUrl) {
  const cognitoUsername = payload['cognito:username'] || payload.sub

  const steamId = payload['custom:steam_id'] ||
    (payload.email?.endsWith('@steam.local')
      ? payload.email.replace('@steam.local', '')
      : null)

  const displayName = payload['custom:display_name'] ||
    payload.preferred_username ||
    steamId ||
    'User'

  const groups = payload['cognito:groups'] || []

  return {
    userId: cognitoUsername,
    steamId,
    displayName,
    avatarUrl,
    groups,
    isAdmin: groups.includes('admins'),
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [isLoading, setIsLoading] = useState(true)

  // Check for existing session on mount
  useEffect(() => {
    checkAuth()
  }, [])

  async function checkAuth() {
    try {
      // Check localStorage for Steam tokens
      const storedTokens = localStorage.getItem(TOKEN_STORAGE_KEY)
      if (storedTokens) {
        const tokens = JSON.parse(storedTokens)
        const expiresAt = tokens.expiresAt || 0

        // Check if token is still valid (with 5 min buffer)
        if (Date.now() < expiresAt - 5 * 60 * 1000) {
          syncTokensToAmplify(tokens)
          const payload = parseJwt(tokens.idToken)
          const avatarUrl = tokens.avatarUrl || localStorage.getItem(AVATAR_STORAGE_KEY)
          setUser(extractUserFromPayload(payload, avatarUrl))
          setIsLoading(false)
          return
        } else {
          localStorage.removeItem(TOKEN_STORAGE_KEY)
        }
      }

      // Fall back to Amplify session check (uses refresh token)
      const session = await fetchAuthSession()
      if (session?.tokens?.idToken) {
        const payload = session.tokens.idToken.payload
        const storedAvatar = localStorage.getItem(AVATAR_STORAGE_KEY)
        setUser(extractUserFromPayload(payload, storedAvatar))
        setIsLoading(false)
        return
      }

      // No valid session
      setUser(null)
    } catch (err) {
      console.error('Auth check failed:', err)
      setUser(null)
    } finally {
      setIsLoading(false)
    }
  }

  // Set tokens from Steam auth callback
  const setSteamTokens = useCallback((tokens) => {
    const expiresAt = Date.now() + tokens.expiresIn * 1000

    localStorage.setItem(
      TOKEN_STORAGE_KEY,
      JSON.stringify({ ...tokens, expiresAt })
    )

    if (tokens.avatarUrl) {
      localStorage.setItem(AVATAR_STORAGE_KEY, tokens.avatarUrl)
    }

    syncTokensToAmplify(tokens)

    const payload = parseJwt(tokens.idToken)
    setUser(extractUserFromPayload(payload, tokens.avatarUrl || null))
  }, [])

  // Sign out
  const handleSignOut = useCallback(async () => {
    try {
      await signOut()
    } catch {
      // Ignore errors from Amplify signOut
    }
    localStorage.removeItem(TOKEN_STORAGE_KEY)
    localStorage.removeItem(AVATAR_STORAGE_KEY)
    setUser(null)
  }, [])

  // Get Steam auth URL from Amplify outputs
  const getSteamAuthUrl = useCallback(() => {
    const outputs = window.amplifyOutputs
    if (outputs?.custom?.steamAuthUrl) {
      return `${outputs.custom.steamAuthUrl}?action=login`
    }
    console.warn('Steam auth URL not found in Amplify outputs')
    return null
  }, [])

  // Get the current access token (for authenticated API calls)
  const getAccessToken = useCallback(() => {
    const stored = localStorage.getItem(TOKEN_STORAGE_KEY)
    if (!stored) return null
    try {
      const tokens = JSON.parse(stored)
      if (tokens.expiresAt && Date.now() >= tokens.expiresAt - 5 * 60 * 1000) return null
      return tokens.accessToken || null
    } catch {
      return null
    }
  }, [])

  const value = {
    user,
    isLoading,
    isAuthenticated: !!user,
    isAdmin: user?.isAdmin || false,
    signOut: handleSignOut,
    getSteamAuthUrl,
    setSteamTokens,
    refreshAuth: checkAuth,
    getAccessToken,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
