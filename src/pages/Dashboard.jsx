import { DriverDashboard } from '@pitvox/partner-react'
import '@pitvox/partner-react/styles.css'
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
