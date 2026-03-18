/**
 * Auth error page.
 *
 * Displays authentication errors with helpful messages.
 */

import { useSearchParams } from 'react-router-dom'

export function AuthError() {
  const [searchParams] = useSearchParams()
  const errorCode = searchParams.get('code') || 'unknown'
  const errorMessage = searchParams.get('message')

  const errorMessages = {
    steam_failed: 'Steam authentication failed. Please try again.',
    user_cancelled: 'You cancelled the Steam login. No account was created.',
    rate_limited: 'Too many login attempts. Please wait a few minutes and try again.',
    server_error: 'A server error occurred. Please try again later.',
    unknown: 'An unexpected error occurred during authentication.',
  }

  const displayMessage = errorMessage
    ? decodeURIComponent(errorMessage)
    : errorMessages[errorCode] || errorMessages.unknown

  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] text-center">
      <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-900/20 flex items-center justify-center">
        <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </div>
      <h1 className="text-2xl font-bold mb-2">Authentication Error</h1>
      <p className="text-gray-400 mb-6">{displayMessage}</p>
      <a href="/" className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-500 transition-colors">
        Return Home
      </a>
      {errorCode !== 'unknown' && (
        <p className="text-gray-600 text-xs mt-4">Error code: {errorCode}</p>
      )}
    </div>
  )
}
