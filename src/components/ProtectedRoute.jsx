/**
 * Route guard that requires authentication.
 * Redirects to home page if not authenticated.
 */

import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

export function ProtectedRoute({ children }) {
  const { isAuthenticated, isLoading } = useAuth()
  const location = useLocation()

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500" />
      </div>
    )
  }

  if (!isAuthenticated) {
    // Save return URL so we can redirect back after login
    sessionStorage.setItem('authReturnTo', location.pathname)
    return <Navigate to="/" state={{ from: location }} replace />
  }

  return children
}
