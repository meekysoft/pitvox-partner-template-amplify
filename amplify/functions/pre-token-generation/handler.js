/**
 * Pre-token generation trigger for Cognito (V2).
 *
 * Adds user attributes (email) to the ACCESS token claims so they're
 * available in downstream services via ctx.identity.claims.
 *
 * This runs every time Cognito generates tokens (login and refresh).
 */

export const handler = async (event) => {
  // Add email to ACCESS token claims (not ID token)
  // The email format is {steamId}@steam.local, which can be used to extract steamId
  event.response = {
    claimsAndScopeOverrideDetails: {
      accessTokenGeneration: {
        claimsToAddOrOverride: {
          email: event.request.userAttributes.email,
        },
      },
    },
  };

  return event;
};
