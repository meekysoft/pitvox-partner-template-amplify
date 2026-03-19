import { useMemo, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  useLeaderboardIndex,
  useTrackLeaderboard,
  useUserLookup,
  useCarMetadata,
  formatTrackName,
  TracksTable,
  CarsTable,
  DriversTable,
  LapHistoryTable,
} from '@pitvox/partner-react'
import '@pitvox/partner-react/styles.css'

export default function Leaderboards() {
  const [searchParams, setSearchParams] = useSearchParams()
  const getUserDisplay = useUserLookup()
  const carMetadata = useCarMetadata()

  // URL-driven state
  const gameParam = searchParams.get('game') || 'evo'
  const versionParam = searchParams.get('version')
  const trackParam = searchParams.get('track')
  const carParam = searchParams.get('car')
  const driverParam = searchParams.get('driver')
  const tagsParam = searchParams.get('tags')
  const showInvalid = searchParams.get('invalid') === 'true'

  // Tag filter — persisted in URL so it survives drill-down navigation
  const activeTags = useMemo(() => {
    if (!tagsParam) return new Set()
    return new Set(tagsParam.split(',').filter(Boolean))
  }, [tagsParam])

  const handleTagChange = useCallback((newTags) => {
    const params = Object.fromEntries(searchParams.entries())
    if (newTags.size > 0) {
      params.tags = [...newTags].join(',')
    } else {
      delete params.tags
    }
    setSearchParams(params)
  }, [searchParams, setSearchParams])

  // Data
  const {
    data: allTracks,
    isLoading: tracksLoading,
    generatedAt,
    totalLaps,
    totalUsers,
    versions,
  } = useLeaderboardIndex({ game: gameParam })

  const gameVersions = versions?.[gameParam]
  const effectiveVersion = versionParam || gameVersions?.default || null

  const tracks = useMemo(() => {
    if (!allTracks || !effectiveVersion) return allTracks || []
    return allTracks.filter((t) => t.gameVersion === effectiveVersion)
  }, [allTracks, effectiveVersion])

  const selectedTrack = useMemo(() => {
    if (!trackParam) return null
    const [id, layout] = trackParam.split('|')
    return { id, layout: layout || null, displayName: formatTrackName(id, layout, gameParam) }
  }, [trackParam, gameParam])

  const { data: trackEntries, isLoading: entriesLoading } = useTrackLeaderboard(
    selectedTrack?.id,
    selectedTrack?.layout,
    { carId: carParam, game: gameParam, gameVersion: effectiveVersion }
  )

  // Navigation — tags are preserved across drill-down
  function nav(params) {
    if (tagsParam) params.tags = tagsParam
    setSearchParams(params)
  }

  function handleGameChange(game) { nav({ game }) }

  function handleVersionChange(version) {
    const params = { game: gameParam }
    if (version && version !== gameVersions?.default) params.version = version
    nav(params)
  }

  function handleTrackSelect(trackId, layout) {
    const params = { game: gameParam, track: layout ? `${trackId}|${layout}` : trackId }
    if (versionParam) params.version = versionParam
    nav(params)
  }

  function handleCarSelect(carId) {
    const params = { game: gameParam, track: trackParam }
    if (versionParam) params.version = versionParam
    if (carId) params.car = carId
    nav(params)
  }

  function handleDriverSelect(userId) {
    const params = { game: gameParam, track: trackParam, car: carParam, driver: userId }
    if (versionParam) params.version = versionParam
    nav(params)
  }

  function handleBreadcrumbNavigate(layer) {
    const params = { game: gameParam }
    if (versionParam) params.version = versionParam
    if (layer === 'track' || layer === 'car') params.track = trackParam
    if (layer === 'car') params.car = carParam
    nav(params)
  }

  function handleToggleInvalid() {
    const params = { game: gameParam, track: trackParam, car: carParam, driver: driverParam }
    if (versionParam) params.version = versionParam
    if (!showInvalid) params.invalid = 'true'
    nav(params)
  }

  // Render current layer
  const renderLayer = () => {
    if (selectedTrack && carParam && driverParam) {
      return (
        <LapHistoryTable
          userId={driverParam}
          track={selectedTrack}
          carId={carParam}
          game={gameParam}
          gameVersion={effectiveVersion}
          showInvalid={showInvalid}
          getUserDisplay={getUserDisplay}
          onToggleInvalid={handleToggleInvalid}
          onNavigate={handleBreadcrumbNavigate}
        />
      )
    }
    if (selectedTrack && carParam) {
      return (
        <DriversTable
          entries={trackEntries || []}
          isLoading={entriesLoading}
          track={selectedTrack}
          carId={carParam}
          getUserDisplay={getUserDisplay}
          onDriverSelect={handleDriverSelect}
          onNavigate={handleBreadcrumbNavigate}
        />
      )
    }
    if (selectedTrack) {
      return (
        <CarsTable
          entries={trackEntries || []}
          isLoading={entriesLoading}
          track={selectedTrack}
          carMetadata={carMetadata}
          getUserDisplay={getUserDisplay}
          onCarSelect={handleCarSelect}
          onNavigate={handleBreadcrumbNavigate}
          tags={activeTags}
          onTagChange={handleTagChange}
        />
      )
    }
    return (
      <TracksTable
        tracks={tracks}
        isLoading={tracksLoading}
        carMetadata={carMetadata}
        getUserDisplay={getUserDisplay}
        onTrackSelect={handleTrackSelect}
        tags={activeTags}
        onTagChange={handleTagChange}
      />
    )
  }

  return (
    <div className="pvx-leaderboard-explorer">
      <div className="pvx-explorer-header">
        <h1 className="pvx-explorer-title">Leaderboards</h1>
        <div className="pvx-explorer-stats">
          {totalLaps > 0 && <span>{totalLaps.toLocaleString()} laps</span>}
          {totalLaps > 0 && totalUsers > 0 && <span className="pvx-explorer-stats-sep">|</span>}
          {totalUsers > 0 && <span>{totalUsers.toLocaleString()} drivers</span>}
        </div>
      </div>

      <div className="pvx-explorer-controls">
        <div className="pvx-game-tabs">
          {['evo', 'acc'].map((g) => (
            <button
              key={g}
              onClick={() => handleGameChange(g)}
              className={`pvx-game-tab ${gameParam === g ? 'pvx-game-tab--active' : ''}`}
            >
              {g === 'evo' ? 'AC EVO' : 'ACC'}
            </button>
          ))}
        </div>
        {gameVersions && (
          <select
            value={effectiveVersion || ''}
            onChange={(e) => handleVersionChange(e.target.value)}
            className="pvx-version-select"
          >
            {gameVersions.available.slice().reverse().map((v) => (
              <option key={v} value={v}>
                v{v}{v === gameVersions.default ? ' (Latest)' : ''}
              </option>
            ))}
          </select>
        )}
      </div>

      {renderLayer()}

      {generatedAt && (
        <p className="pvx-data-timestamp">
          Data updated: {new Date(generatedAt).toLocaleString()}
        </p>
      )}
    </div>
  )
}
