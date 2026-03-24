/**
 * AppSync HTTP resolver — get server info for a registered driver.
 *
 * Proxies to pitvox-api: GET /api/v1/competitions/{id}/server-info?steam_id={steamId}
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

  let resourcePath = `/api/v1/competitions/${ctx.args.competitionId}/server-info?steam_id=${steamId}`
  if (ctx.args.roundNumber != null) {
    resourcePath += `&round_number=${ctx.args.roundNumber}`
  }

  return {
    method: 'GET',
    resourcePath,
    params: {
      headers: {
        'X-Partner-Key': ctx.env.PARTNER_API_KEY,
      },
    },
  }
}

export function response(ctx) {
  if (ctx.error) {
    return { success: false, error: ctx.error.message }
  }

  const statusCode = ctx.result.statusCode
  const body = JSON.parse(ctx.result.body || '{}')

  if (statusCode !== 200) {
    return { success: false, error: body.detail || body.error || `Failed to get server info (${statusCode})` }
  }

  return {
    success: true,
    serverAddress: body.server_address || null,
    serverPassword: body.server_password || null,
  }
}
