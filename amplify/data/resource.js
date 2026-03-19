import { a, defineData } from '@aws-amplify/backend';

/**
 * AppSync API schema for partner sites.
 *
 * Defines competition registration mutations backed by HTTP data source
 * resolvers that proxy to pitvox-api. No Lambda cold starts — AppSync
 * resolves the HTTP requests directly.
 *
 * All mutations require Cognito authentication. The user's Steam ID is
 * extracted server-side from the token's email claim, preventing
 * impersonation.
 */
const schema = a.schema({
  // ── Response types ──────────────────────────────────────────────

  RegistrationResponse: a.customType({
    success: a.boolean().required(),
    id: a.string(),
    error: a.string(),
  }),

  // ── Queries ────────────────────────────────────────────────────
  // AppSync requires at least one query. This also serves as a
  // handy health-check endpoint for the API.

  /**
   * Simple ping query — returns true if the API is reachable.
   */
  ping: a
    .query()
    .returns(a.boolean())
    .authorization((allow) => [allow.authenticated()])
    .handler(
      a.handler.custom({
        entry: './resolvers/ping.js',
      })
    ),

  // ── Competition registration mutations ──────────────────────────

  /**
   * Register the authenticated user for a competition.
   */
  registerForCompetition: a
    .mutation()
    .arguments({
      competitionId: a.string().required(),
      displayName: a.string().required(),
      avatarUrl: a.string(),
      discordUsername: a.string(),
      experience: a.string(),
      comments: a.string(),
    })
    .returns(a.ref('RegistrationResponse'))
    .authorization((allow) => [allow.authenticated()])
    .handler(
      a.handler.custom({
        dataSource: 'PitvoxApiDataSource',
        entry: './resolvers/registerForCompetition.js',
      })
    ),

  /**
   * Withdraw the authenticated user from a competition.
   */
  withdrawFromCompetition: a
    .mutation()
    .arguments({
      competitionId: a.string().required(),
    })
    .returns(a.ref('RegistrationResponse'))
    .authorization((allow) => [allow.authenticated()])
    .handler(
      a.handler.custom({
        dataSource: 'PitvoxApiDataSource',
        entry: './resolvers/withdrawFromCompetition.js',
      })
    ),
});

export const data = defineData({
  schema,
  authorizationModes: {
    defaultAuthorizationMode: 'userPool',
  },
});
