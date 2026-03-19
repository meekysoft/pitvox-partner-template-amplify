/**
 * AppSync HTTP resolver — fetch notifications.
 *
 * Proxies to pitvox-api: GET /api/v1/notifications
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

  const params = new URLSearchParams()
  params.set('steamId', steamId)
  if (ctx.args.limit) params.set('limit', ctx.args.limit)
  if (ctx.args.offset) params.set('offset', ctx.args.offset)
  if (ctx.args.unreadOnly) params.set('unread_only', 'true')

  const qs = params.toString()

  return {
    method: 'GET',
    resourcePath: `/api/v1/notifications?${qs}`,
    params: {
      headers: {
        'X-Partner-Key': ctx.env.PARTNER_API_KEY,
      },
    },
  }
}

export function response(ctx) {
  if (ctx.error) {
    return { notifications: [], unreadCount: 0 }
  }

  const statusCode = ctx.result.statusCode
  const body = JSON.parse(ctx.result.body || '{}')

  if (statusCode !== 200) {
    return { notifications: [], unreadCount: 0 }
  }

  return {
    notifications: (body.notifications || []).map((n) => ({
      id: n.id,
      type: n.type,
      title: n.title,
      message: n.message || null,
      isRead: n.isRead || n.is_read || false,
      createdAt: n.createdAt || n.created_at,
      readAt: n.readAt || n.read_at || null,
      trackId: n.trackId || n.track_id || null,
      trackLayout: n.trackLayout || n.track_layout || null,
      carId: n.carId || n.car_id || null,
      game: n.game || null,
      data: n.data || null,
    })),
    unreadCount: body.unreadCount ?? body.unread_count ?? 0,
  }
}
