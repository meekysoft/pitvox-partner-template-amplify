import { Link } from 'react-router-dom'
import { useCompetitions, useLeaderboardIndex } from '@pitvox/partner-react'
import { useAuth } from '../hooks/useAuth'

export default function Home() {
  const { data: competitions } = useCompetitions()
  const { data: tracks } = useLeaderboardIndex()
  const { isAuthenticated, getSteamAuthUrl } = useAuth()

  const activeCount = competitions?.filter((c) => c.status === 'active').length ?? 0
  const trackCount = tracks?.length ?? 0

  return (
    <div className="space-y-12">
      <section className="text-center py-16">
        <h1 className="text-5xl font-bold tracking-tight mb-4">
          My Racing Community
        </h1>
        <p className="text-xl text-gray-400 max-w-2xl mx-auto mb-8">
          Sim racing competitions, leaderboards, and more — powered by PitVox.
        </p>
        {!isAuthenticated && (
          <a
            href={getSteamAuthUrl() || '#'}
            className="inline-flex items-center gap-2 px-6 py-3 bg-gray-800 hover:bg-gray-700 text-white font-medium rounded-lg transition-colors border border-gray-700"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C6.48 2 2 6.04 2 11.04c0 3.15 1.72 5.92 4.32 7.52l2.98-4.33c-.48-.55-.78-1.26-.78-2.04 0-1.72 1.4-3.12 3.12-3.12s3.12 1.4 3.12 3.12-1.4 3.12-3.12 3.12c-.34 0-.66-.06-.96-.16l-2.98 4.33C8.98 20.16 10.44 20.6 12 20.6c5.52 0 10-4.04 10-9.04S17.52 2 12 2z" />
            </svg>
            Sign in with Steam
          </a>
        )}
      </section>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Link
          to="/competitions"
          className="group block rounded-xl border border-gray-800 bg-gray-900 p-8 hover:border-indigo-500/50 transition-colors"
        >
          <h2 className="text-2xl font-semibold mb-2 group-hover:text-indigo-400 transition-colors">
            Competitions
          </h2>
          <p className="text-gray-400">
            {activeCount > 0
              ? `${activeCount} active competition${activeCount !== 1 ? 's' : ''}`
              : 'View our championship series'}
          </p>
        </Link>

        <Link
          to="/leaderboards"
          className="group block rounded-xl border border-gray-800 bg-gray-900 p-8 hover:border-indigo-500/50 transition-colors"
        >
          <h2 className="text-2xl font-semibold mb-2 group-hover:text-indigo-400 transition-colors">
            Leaderboards
          </h2>
          <p className="text-gray-400">
            {trackCount > 0
              ? `${trackCount} track${trackCount !== 1 ? 's' : ''} with hotlap records`
              : 'Compete for the fastest lap times'}
          </p>
        </Link>
      </div>
    </div>
  )
}
