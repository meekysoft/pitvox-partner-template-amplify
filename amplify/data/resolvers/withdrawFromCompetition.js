/**
 * AppSync HTTP resolver — withdraw from a competition.
 *
 * Proxies to pitvox-api: DELETE /api/v1/competitions/{id}/register/{steamId}
 * Steam ID is extracted from the Cognito token (not from client input).
 */

export function request(ctx) {
  const email = ctx.identity.claims.email
  let steamId = null
  if (email && email.endsWith('@steam.local')) {
    steamId = email.replace('@steam.local', '')
  }

  if (!steamId) {
    runtime.earlyReturn({ success: false, error: 'Could not determine Steam ID from token' })
  }

  return {
    method: 'DELETE',
    resourcePath: `/api/v1/competitions/${ctx.args.competitionId}/register/${steamId}`,
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

  if (statusCode === 404) {
    return { success: false, error: 'Not registered for this competition' }
  }

  if (statusCode !== 200) {
    return { success: false, error: body.detail || body.error || `Withdrawal failed (${statusCode})` }
  }

  return {
    success: true,
    id: body.id || null,
  }
}
