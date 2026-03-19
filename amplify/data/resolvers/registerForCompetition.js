/**
 * AppSync HTTP resolver — register for a competition.
 *
 * Proxies to pitvox-api: POST /api/v1/competitions/{id}/register
 * Steam ID is extracted from the Cognito token (not from client input).
 */

export function request(ctx) {
  const email = ctx.identity.claims.email
  let steamId = null
  if (email && email.endsWith('@steam.local')) {
    steamId = email.replace('@steam.local', '')
  }

  if (!steamId) {
    return { error: 'Could not determine Steam ID from token' }
  }

  const body = {
    steam_id: steamId,
    display_name: ctx.args.displayName,
  }
  if (ctx.args.avatarUrl) body.avatar_url = ctx.args.avatarUrl
  if (ctx.args.discordUsername) body.discord_username = ctx.args.discordUsername
  if (ctx.args.experience) body.experience = ctx.args.experience
  if (ctx.args.comments) body.comments = ctx.args.comments

  return {
    method: 'POST',
    resourcePath: `/api/v1/competitions/${ctx.args.competitionId}/register`,
    params: {
      headers: {
        'Content-Type': 'application/json',
        'X-Partner-Key': ctx.env.PARTNER_API_KEY,
      },
      body: JSON.stringify(body),
    },
  }
}

export function response(ctx) {
  if (ctx.error) {
    return { success: false, error: ctx.error.message }
  }

  const statusCode = ctx.result.statusCode
  const body = JSON.parse(ctx.result.body || '{}')

  if (statusCode === 409) {
    return { success: false, error: body.detail || 'Already registered for this competition' }
  }

  if (statusCode !== 200 && statusCode !== 201) {
    return { success: false, error: body.detail || body.error || `Registration failed (${statusCode})` }
  }

  return {
    success: true,
    id: body.id || null,
  }
}
