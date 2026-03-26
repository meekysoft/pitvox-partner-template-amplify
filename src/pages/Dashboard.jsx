import { DriverDashboard } from '@pitvox/partner-react'
import { useAuth } from '../hooks/useAuth'

export default function Dashboard() {
  const { user } = useAuth()

  return (
    <DriverDashboard
      steamId={user?.steamId}
      avatarUrl={user?.avatarUrl}
    />
  )
}
