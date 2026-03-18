import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

const publicLinks = [
  { to: '/', label: 'Home' },
  { to: '/competitions', label: 'Competitions' },
  { to: '/leaderboards', label: 'Leaderboards' },
]

function NavItem({ to, label }) {
  return (
    <NavLink
      to={to}
      end={to === '/'}
      className={({ isActive }) =>
        `px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
          isActive
            ? 'bg-indigo-600 text-white'
            : 'text-gray-300 hover:bg-gray-700 hover:text-white'
        }`
      }
    >
      {label}
    </NavLink>
  )
}

export default function Layout() {
  const { isAuthenticated, isLoading, user, signOut, getSteamAuthUrl } = useAuth()

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <nav className="border-b border-gray-800 bg-gray-900/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <NavLink to="/" className="text-xl font-bold text-white tracking-tight">
              My Racing Community
            </NavLink>
            <div className="flex items-center gap-1">
              {publicLinks.map((link) => (
                <NavItem key={link.to} {...link} />
              ))}

              {!isLoading && isAuthenticated && (
                <>
                  <NavItem to="/dashboard" label="Dashboard" />
                  <button
                    onClick={signOut}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-gray-300 hover:bg-gray-700 hover:text-white transition-colors"
                  >
                    {user?.avatarUrl && (
                      <img
                        src={user.avatarUrl}
                        alt=""
                        className="w-6 h-6 rounded-full"
                      />
                    )}
                    Sign out
                  </button>
                </>
              )}

              {!isLoading && !isAuthenticated && (
                <a
                  href={getSteamAuthUrl() || '#'}
                  className="ml-2 px-4 py-2 rounded-lg text-sm font-medium bg-gray-800 text-gray-200 hover:bg-gray-700 hover:text-white transition-colors border border-gray-700"
                >
                  Sign in
                </a>
              )}
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Outlet />
      </main>

      <footer className="border-t border-gray-800 mt-auto">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 text-center text-sm text-gray-500">
          Powered by <a href="https://pitvox.com" className="text-indigo-400 hover:text-indigo-300">PitVox</a>
        </div>
      </footer>
    </div>
  )
}
