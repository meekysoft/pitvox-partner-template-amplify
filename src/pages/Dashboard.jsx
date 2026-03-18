import { DriverDashboard } from '@pitvox/partner-react'
import '@pitvox/partner-react/styles.css'
import { useAuth } from '../hooks/useAuth'

export default function Dashboard() {
  const { user } = useAuth()

  return (
    <div className="space-y-8">
      <DriverDashboard
        steamId={user?.steamId}
        avatarUrl={user?.avatarUrl}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="rounded-xl border border-gray-800 bg-gray-900 p-6">
          <h2 className="text-lg font-semibold mb-2">Competitions</h2>
          <p className="text-gray-400 text-sm mb-4">
            View active competitions and register to participate.
          </p>
          <a
            href="/competitions"
            className="text-indigo-400 hover:text-indigo-300 text-sm font-medium"
          >
            Browse competitions &rarr;
          </a>
        </div>

        <div className="rounded-xl border border-gray-800 bg-gray-900 p-6">
          <h2 className="text-lg font-semibold mb-2">Leaderboards</h2>
          <p className="text-gray-400 text-sm mb-4">
            Check your lap times and see how you stack up.
          </p>
          <a
            href="/leaderboards"
            className="text-indigo-400 hover:text-indigo-300 text-sm font-medium"
          >
            View leaderboards &rarr;
          </a>
        </div>
      </div>
    </div>
  )
}
