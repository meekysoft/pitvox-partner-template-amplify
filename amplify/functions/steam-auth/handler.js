/**
 * Steam Authentication Handler
 *
 * Handles Steam OpenID authentication flow:
 * 1. ?action=login — Redirects user to Steam login page
 * 2. Steam callback — Validates response, creates/updates Cognito user, returns tokens
 *
 * Users are identified by their Steam ID, stored as {steamId}@steam.local in Cognito.
 */

import SteamAuth from 'node-steam-openid';
import {
  CognitoIdentityProviderClient,
  AdminGetUserCommand,
  AdminCreateUserCommand,
  AdminSetUserPasswordCommand,
  AdminInitiateAuthCommand,
  AdminAddUserToGroupCommand,
  AdminUpdateUserAttributesCommand,
} from '@aws-sdk/client-cognito-identity-provider';
import {
  getClientIp,
  checkRateLimits,
  rateLimitResponse,
} from './rate-limiter.js';

const cognitoClient = new CognitoIdentityProviderClient({});

// Admin Steam IDs — users with these Steam IDs get added to the admins group
const ADMIN_STEAM_IDS = (process.env.ADMIN_STEAM_IDS || '')
  .split(',')
  .map((id) => id.trim())
  .filter(Boolean);

/**
 * Build Steam auth instance with dynamic URLs based on request
 */
function createSteamAuth(host, protocol = 'https') {
  const baseUrl = `${protocol}://${host}`;
  return new SteamAuth({
    realm: baseUrl,
    returnUrl: baseUrl,
    apiKey: process.env.STEAM_API_KEY,
  });
}

/**
 * Convert Steam ID to Cognito email (used as username)
 */
function steamIdToEmail(steamId) {
  return `${steamId}@steam.local`;
}

/**
 * Check if user exists in Cognito
 */
async function getUser(steamId) {
  try {
    const email = steamIdToEmail(steamId);
    const response = await cognitoClient.send(
      new AdminGetUserCommand({
        UserPoolId: process.env.COGNITO_USER_POOL_ID,
        Username: email,
      })
    );
    return response;
  } catch (error) {
    if (error.name === 'UserNotFoundException') {
      return null;
    }
    throw error;
  }
}

/**
 * Create new Cognito user with Steam profile data
 */
async function createUser(steamId, displayName, avatarUrl) {
  const tempPassword = crypto.randomUUID() + 'Aa1!';
  const email = steamIdToEmail(steamId);

  await cognitoClient.send(
    new AdminCreateUserCommand({
      UserPoolId: process.env.COGNITO_USER_POOL_ID,
      Username: email,
      UserAttributes: [
        { Name: 'email', Value: email },
        { Name: 'email_verified', Value: 'true' },
        { Name: 'preferred_username', Value: displayName || steamId },
        { Name: 'custom:steam_id', Value: steamId },
        { Name: 'custom:display_name', Value: displayName || 'Unknown' },
        ...(avatarUrl ? [{ Name: 'custom:avatar_url', Value: avatarUrl }] : []),
      ],
      MessageAction: 'SUPPRESS', // Don't send welcome email
    })
  );

  // Set permanent password to skip force-change-password state
  await cognitoClient.send(
    new AdminSetUserPasswordCommand({
      UserPoolId: process.env.COGNITO_USER_POOL_ID,
      Username: email,
      Password: tempPassword,
      Permanent: true,
    })
  );

  return tempPassword;
}

/**
 * Update existing user's Steam profile data
 */
async function updateUserProfile(steamId, displayName, avatarUrl) {
  const email = steamIdToEmail(steamId);

  const attributes = [
    { Name: 'preferred_username', Value: displayName || steamId },
    { Name: 'custom:display_name', Value: displayName || 'Unknown' },
  ];

  if (avatarUrl) {
    attributes.push({ Name: 'custom:avatar_url', Value: avatarUrl });
  }

  await cognitoClient.send(
    new AdminUpdateUserAttributesCommand({
      UserPoolId: process.env.COGNITO_USER_POOL_ID,
      Username: email,
      UserAttributes: attributes,
    })
  );
}

/**
 * Get Cognito tokens for user
 */
async function authenticateUser(steamId, password) {
  const email = steamIdToEmail(steamId);
  const response = await cognitoClient.send(
    new AdminInitiateAuthCommand({
      UserPoolId: process.env.COGNITO_USER_POOL_ID,
      ClientId: process.env.COGNITO_CLIENT_ID,
      AuthFlow: 'ADMIN_USER_PASSWORD_AUTH',
      AuthParameters: {
        USERNAME: email,
        PASSWORD: password,
      },
    })
  );

  return response.AuthenticationResult;
}

/**
 * Add user to admins group if they're in the admin list
 */
async function syncAdminGroup(steamId) {
  if (!ADMIN_STEAM_IDS.includes(steamId)) return;

  const email = steamIdToEmail(steamId);
  try {
    await cognitoClient.send(
      new AdminAddUserToGroupCommand({
        UserPoolId: process.env.COGNITO_USER_POOL_ID,
        Username: email,
        GroupName: 'admins',
      })
    );
    console.log('Added user to admins group:', steamId);
  } catch (error) {
    console.error('Failed to add user to admins group:', error);
  }
}

export const handler = async (event) => {
  const params = event.queryStringParameters || {};
  const action = params.action;
  const isOpenIdCallback = params['openid.mode'] === 'id_res';
  const host = event.headers?.host || event.headers?.Host;
  const protocol = event.headers?.['x-forwarded-proto'] || 'https';

  // Frontend URL for redirects after auth
  const frontendUrl = process.env.SITE_URL;

  // Get client IP for rate limiting
  const clientIp = getClientIp(event);

  console.log('Steam auth handler:', { action, isOpenIdCallback, host, protocol, frontendUrl, clientIp });

  try {
    // Action: Initiate Steam login
    if (action === 'login') {
      const rateCheck = await checkRateLimits(clientIp, 'login');
      if (!rateCheck.allowed) {
        console.warn('Rate limit exceeded for login:', { clientIp, reason: rateCheck.reason });
        return rateLimitResponse(rateCheck.reason, rateCheck.retryAfter, frontendUrl);
      }

      const steam = createSteamAuth(host, protocol);
      const redirectUrl = await steam.getRedirectUrl();

      return {
        statusCode: 302,
        headers: { Location: redirectUrl },
        body: '',
      };
    }

    // Handle Steam OpenID callback
    if (isOpenIdCallback) {
      const rateCheck = await checkRateLimits(clientIp, 'callback');
      if (!rateCheck.allowed) {
        console.warn('Rate limit exceeded for callback:', { clientIp, reason: rateCheck.reason });
        return rateLimitResponse(rateCheck.reason, rateCheck.retryAfter, frontendUrl);
      }

      const steam = createSteamAuth(host, protocol);

      // Reconstruct the full URL for validation
      const queryString = event.rawQueryString ||
        Object.entries(params).map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&');

      // node-steam-openid expects a request-like object
      const mockRequest = {
        url: `/?${queryString}`,
        headers: { host },
        method: 'GET',
        connection: {},
      };

      let steamUser;
      try {
        steamUser = await steam.authenticate(mockRequest);
      } catch (authError) {
        console.error('Steam authentication failed:', {
          message: authError?.message,
          name: authError?.name,
        });
        return {
          statusCode: 302,
          headers: { Location: `${frontendUrl}/auth/error?code=steam_failed` },
          body: '',
        };
      }

      const steamId = steamUser.steamid;
      const displayName = steamUser.username || steamId;
      const avatarUrl = steamUser.avatar?.medium || steamUser.avatar?.small || null;

      console.log('Steam user authenticated:', { steamId, displayName });

      // Check if user exists in Cognito
      let user = await getUser(steamId);
      let password;

      if (!user) {
        console.log('Creating new Cognito user for Steam ID:', steamId);
        password = await createUser(steamId, displayName, avatarUrl);
      } else {
        // Update profile data and reset password for login
        await updateUserProfile(steamId, displayName, avatarUrl);
        password = crypto.randomUUID() + 'Aa1!';
        await cognitoClient.send(
          new AdminSetUserPasswordCommand({
            UserPoolId: process.env.COGNITO_USER_POOL_ID,
            Username: steamIdToEmail(steamId),
            Password: password,
            Permanent: true,
          })
        );
      }

      // Sync admin group membership (before auth so token includes group)
      await syncAdminGroup(steamId);

      // Get Cognito tokens
      const tokens = await authenticateUser(steamId, password);

      // Redirect to frontend with tokens
      const tokenParams = new URLSearchParams({
        idToken: tokens.IdToken,
        accessToken: tokens.AccessToken,
        refreshToken: tokens.RefreshToken || '',
        expiresIn: String(tokens.ExpiresIn || 3600),
      });

      // Include avatar URL if available
      if (avatarUrl) {
        tokenParams.set('avatarUrl', avatarUrl);
      }

      return {
        statusCode: 302,
        headers: { Location: `${frontendUrl}/auth/complete?${tokenParams.toString()}` },
        body: '',
      };
    }

    // Unknown action
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Invalid action. Use ?action=login to initiate Steam authentication.' }),
    };
  } catch (error) {
    console.error('Steam auth error:', {
      message: error?.message,
      name: error?.name,
      stack: error?.stack,
    });
    return {
      statusCode: 302,
      headers: { Location: `${frontendUrl}/auth/error?code=server_error` },
      body: '',
    };
  }
};
