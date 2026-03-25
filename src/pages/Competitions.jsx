import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  useCompetitions,
  useCompetitionConfig,
  useCompetitionAllRounds,
  CompetitionCard,
  StandingsTable,
  RoundSessionResults,
  RegistrationPanel,
  TypeBadge,
  InfoPill,
  PODIUM_MEDALS,
  CompLoadingState,
  CompEmptyState,
} from '@pitvox/partner-react'
import '@pitvox/partner-react/styles.css'

export default function Competitions() {
  const [searchParams, setSearchParams] = useSearchParams()
  const competitionId = searchParams.get('competition')
  const view = searchParams.get('view')

  const { data: competitions, isLoading: loadingList } = useCompetitions()

  function handleSelectCompetition(id) {
    setSearchParams({ competition: id })
  }

  function handleRegisterCompetition(id) {
    setSearchParams({ competition: id, view: 'register' })
  }

  function handleBackToList() {
    setSearchParams({})
  }

  function handleBackToResults() {
    setSearchParams({ competition: competitionId })
  }

  // ─── Cards grid ──────────────────────────────────────────────

  if (!competitionId) {
    return (
      <div className="pvx-comp-explorer">
        <div className="pvx-explorer-header">
          <h2 className="pvx-explorer-title">Competitions</h2>
          {!loadingList && competitions?.length > 0 && (
            <div className="pvx-explorer-stats">
              <span>{competitions.length} competition{competitions.length !== 1 ? 's' : ''}</span>
            </div>
          )}
        </div>
        {loadingList ? (
          <CompLoadingState message="Loading competitions..." />
        ) : !competitions?.length ? (
          <CompEmptyState message="No competitions available." />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {competitions.map((comp) => (
              <CompetitionCard
                key={comp.id}
                comp={comp}
                onSelect={handleSelectCompetition}
                onRegister={handleRegisterCompetition}
              />
            ))}
          </div>
        )}
      </div>
    )
  }

  // ─── Registration view ───────────────────────────────────────

  if (view === 'register') {
    return (
      <div className="pvx-comp-explorer">
        <CompetitionRegistrationView
          competitionId={competitionId}
          onBack={handleBackToResults}
          onBackToList={handleBackToList}
        />
      </div>
    )
  }

  // ─── Results view ────────────────────────────────────────────

  return (
    <div className="pvx-comp-explorer">
      <CompetitionResultsView
        competitionId={competitionId}
        onBack={handleBackToList}
        onRegister={() => handleRegisterCompetition(competitionId)}
      />
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════
// Results View — standings table + round accordion
// ═══════════════════════════════════════════════════════════════════

function CompetitionResultsView({ competitionId, onBack, onRegister }) {
  const { data: config, isLoading: configLoading } = useCompetitionConfig(competitionId)

  const isChampionship = config?.type === 'championship'
  const finalizedRounds = config?.rounds?.filter((r) => r.isFinalized) || []
  const roundNumbers = finalizedRounds.map((r) => r.roundNumber)

  const { data: rounds = [], isLoading: roundsLoading } = useCompetitionAllRounds(
    competitionId,
    roundNumbers,
  )

  if (configLoading || roundsLoading) {
    return <CompLoadingState message="Loading competition..." />
  }

  if (!config) {
    return (
      <div>
        <CompEmptyState message="Competition not found." />
        <div className="pvx-comp-back-link-wrap">
          <button onClick={onBack} className="pvx-comp-back-link">
            &larr; Back to competitions
          </button>
        </div>
      </div>
    )
  }

  const hasStandings = isChampionship
  const hasRounds = rounds.length > 0

  return (
    <>
      {/* Header */}
      <div className="pvx-comp-results-header">
        <div>
          <button onClick={onBack} className="pvx-comp-back-link">
            &larr; All Competitions
          </button>
          <h2 className="pvx-explorer-title">{config.name}</h2>
          {config.description && (
            <p className="pvx-comp-detail-desc">{config.description}</p>
          )}
          <div className="pvx-comp-detail-meta">
            <TypeBadge type={config.type} />
            {config.game && <InfoPill>{config.game.toUpperCase()}</InfoPill>}
            {config.countingRounds > 0 && (
              <InfoPill variant="format">
                Best {config.countingRounds} of {(config.rounds || []).length} rounds count
              </InfoPill>
            )}
          </div>
        </div>
        {config.registration && (
          <RegistrationCTA config={config} onRegister={onRegister} />
        )}
      </div>

      {!hasStandings && !hasRounds ? (
        <div className="pvx-empty">
          <p>No results available yet.</p>
          <p className="pvx-comp-empty-sub">Results will appear here once rounds are finalised.</p>
        </div>
      ) : (
        <>
          {/* Championship Standings */}
          {hasStandings && (
            <StandingsTable competitionId={competitionId} />
          )}

          {/* Round Results — Accordion */}
          {hasRounds && (
            <div className="pvx-card">
              <div className="pvx-card-header">
                <h3 className="pvx-card-title">Round Results</h3>
              </div>
              <div className="pvx-comp-accordion">
                {rounds.map((round) => (
                  <RoundAccordionItem
                    key={round.roundNumber}
                    round={round}
                  />
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </>
  )
}

function RegistrationCTA({ config, onRegister }) {
  const reg = config.registration
  if (!reg) return null

  const count = reg.currentCount || 0
  const max = reg.maxParticipants
  const isFull = max && count >= max
  const deadlinePassed = reg.deadline && new Date(reg.deadline) < new Date()
  const regOpen = reg.isOpen && !deadlinePassed && !isFull

  const pct = max ? (count / max) * 100 : 0
  const capacityVariant = pct >= 100 ? 'full' : pct >= 75 ? 'warning' : 'ok'

  return (
    <div className="pvx-comp-results-cta">
      <span className={`pvx-reg-capacity pvx-reg-capacity--${capacityVariant}`}>
        {count}/{max || '\u221E'} drivers
      </span>
      {regOpen ? (
        <button className="pvx-comp-register-btn" onClick={onRegister}>
          Register
        </button>
      ) : (
        <span className="pvx-comp-card-reg-btn pvx-comp-card-reg-btn--closed">
          {isFull ? 'Full' : 'Registration Closed'}
        </span>
      )}
    </div>
  )
}

// ─── Round Accordion ────────────────────────────────────────────

function RoundAccordionItem({ round }) {
  const [isOpen, setIsOpen] = useState(false)

  const raceSession = round.sessions?.find((s) => s.type === 'RACE')
  const podium = raceSession?.results?.filter((r) => r.position <= 3).sort((a, b) => a.position - b.position)

  return (
    <div className={`pvx-accordion-item ${isOpen ? 'pvx-accordion-item--open' : ''}`}>
      <button
        className="pvx-accordion-toggle"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
      >
        <div className="pvx-accordion-toggle-content">
          <div className="pvx-accordion-toggle-title">
            <span className="pvx-accordion-round-label">
              Round {round.roundNumber}: {round.track || 'TBC'}
            </span>
            {round.startTime && (
              <span className="pvx-accordion-round-date">
                {new Date(round.startTime).toLocaleDateString('en-GB', {
                  day: 'numeric', month: 'long', year: 'numeric',
                })}
              </span>
            )}
          </div>
          {podium?.length > 0 && (
            <div className="pvx-accordion-podium">
              {podium.map((r) => (
                <span key={r.driverId} className="pvx-round-podium-item">
                  <span>{PODIUM_MEDALS[r.position - 1]}</span>
                  <span>{r.driverName}</span>
                </span>
              ))}
            </div>
          )}
        </div>
        <svg
          className={`pvx-accordion-chevron ${isOpen ? 'pvx-accordion-chevron--open' : ''}`}
          viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
          strokeLinecap="round" strokeLinejoin="round"
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>
      {isOpen && (
        <div className="pvx-accordion-content">
          <RoundSessionResults round={round} />
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════
// Registration View
// ═══════════════════════════════════════════════════════════════════

function CompetitionRegistrationView({ competitionId, onBack, onBackToList }) {
  const { data: config, isLoading } = useCompetitionConfig(competitionId)

  if (isLoading) {
    return <CompLoadingState message="Loading..." />
  }

  if (!config) {
    return (
      <div>
        <CompEmptyState message="Competition not found." />
        <div className="pvx-comp-back-link-wrap">
          <button onClick={onBackToList} className="pvx-comp-back-link">
            &larr; Back to competitions
          </button>
        </div>
      </div>
    )
  }

  return (
    <>
      <button onClick={onBack} className="pvx-comp-back-link">
        &larr; {config.name}
      </button>
      <div className="pvx-comp-detail-header">
        <h2 className="pvx-explorer-title">{config.name}</h2>
      </div>
      <RegistrationPanel
        competitionId={competitionId}
        registration={config.registration}
        onWithdrawSuccess={onBackToList}
      />
    </>
  )
}
