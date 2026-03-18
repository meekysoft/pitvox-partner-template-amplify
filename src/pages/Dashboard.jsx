import { useAuth } from '../hooks/useAuth'

export default function Dashboard() {
  const { user } = useAuth()

  return (
    <div className="space-y-8">
      <section className="flex items-center gap-4">
        {user?.avatarUrl && (
          <img
            src={user.avatarUrl}
            alt={user.displayName}
            className="w-16 h-16 rounded-full border-2 border-gray-700"
          />
        )}
        <div>
          <h1 className="text-3xl font-bold">Welcome, {user?.displayName}</h1>
          <p className="text-gray-400 text-sm">Steam ID: {user?.steamId}</p>
        </div>
      </section>

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
