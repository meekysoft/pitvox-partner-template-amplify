/**
 * AppSync HTTP resolver — mark all notifications as read.
 *
 * Proxies to pitvox-api: PATCH /api/v1/notifications/read-all
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

  return {
    method: 'PATCH',
    resourcePath: '/api/v1/notifications/read-all',
    params: {
      headers: {
        'X-Partner-Key': ctx.env.PARTNER_API_KEY,
      },
      query: { steamId },
    },
  }
}

export function response(ctx) {
  if (ctx.error) {
    return { success: false, error: ctx.error.message }
  }

  const statusCode = ctx.result.statusCode

  if (statusCode !== 200) {
    const body = JSON.parse(ctx.result.body || '{}')
    return { success: false, error: body.detail || `Failed (${statusCode})` }
  }

  return { success: true }
}
