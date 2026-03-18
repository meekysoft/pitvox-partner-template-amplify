/**
 * Competition Registration Proxy
 *
 * Proxies registration and withdrawal requests to the PitVox API,
 * keeping the partner API key server-side (never exposed to the browser).
 *
 * Authentication: Validates Cognito access tokens via JWKS. Only
 * authenticated users can register/withdraw, and the steam_id in the
 * token must match the request to prevent impersonation.
 *
 * Endpoints:
 *   POST ?action=register&competitionId=xxx  — Register a driver
 *   POST ?action=withdraw&competitionId=xxx&steamId=yyy — Withdraw a driver
 */

import { createVerify } from 'crypto';

const PITVOX_API_URL = process.env.PITVOX_API_URL || 'https://api.pitvox.com';
const PARTNER_API_KEY = process.env.PARTNER_API_KEY;
const COGNITO_USER_POOL_ID = process.env.COGNITO_USER_POOL_ID;
const AWS_REGION = process.env.AWS_REGION || 'us-east-1';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// Cache JWKS in memory across invocations
let jwksCache = null;
let jwksCacheTime = 0;
const JWKS_CACHE_TTL = 60 * 60 * 1000; // 1 hour

function jsonResponse(statusCode, body) {
  return {
    statusCode,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  };
}

// ─── JWT verification ────────────────────────────────────────────────────────

/**
 * Base64url decode (RFC 7515)
 */
function base64urlDecode(str) {
  const padded = str + '='.repeat((4 - (str.length % 4)) % 4);
  return Buffer.from(padded.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
}

/**
 * Fetch JWKS from Cognito (cached)
 */
async function getJwks() {
  if (jwksCache && Date.now() - jwksCacheTime < JWKS_CACHE_TTL) {
    return jwksCache;
  }

  const jwksUrl = `https://cognito-idp.${AWS_REGION}.amazonaws.com/${COGNITO_USER_POOL_ID}/.well-known/jwks.json`;
  const res = await fetch(jwksUrl);
  if (!res.ok) throw new Error(`Failed to fetch JWKS: ${res.status}`);

  jwksCache = await res.json();
  jwksCacheTime = Date.now();
  return jwksCache;
}

/**
 * Convert a JWK RSA key to PEM format for Node's crypto module
 */
function jwkToPem(jwk) {
  // Build the RSA public key in DER format, then wrap in PEM
  const n = base64urlDecode(jwk.n);
  const e = base64urlDecode(jwk.e);

  // ASN.1 DER encoding for RSA public key
  function encodeLength(length) {
    if (length < 0x80) return Buffer.from([length]);
    if (length < 0x100) return Buffer.from([0x81, length]);
    return Buffer.from([0x82, (length >> 8) & 0xff, length & 0xff]);
  }

  function encodeUnsignedInteger(buf) {
    // Add leading zero if high bit is set (to keep it positive)
    const needsPad = buf[0] & 0x80;
    const intBody = needsPad ? Buffer.concat([Buffer.from([0x00]), buf]) : buf;
    return Buffer.concat([Buffer.from([0x02]), encodeLength(intBody.length), intBody]);
  }

  const encodedN = encodeUnsignedInteger(n);
  const encodedE = encodeUnsignedInteger(e);
  const rsaSequence = Buffer.concat([encodedN, encodedE]);
  const rsaSequenceWrapped = Buffer.concat([
    Buffer.from([0x30]),
    encodeLength(rsaSequence.length),
    rsaSequence,
  ]);

  // BitString wrapper
  const bitString = Buffer.concat([
    Buffer.from([0x03]),
    encodeLength(rsaSequenceWrapped.length + 1),
    Buffer.from([0x00]), // unused bits
    rsaSequenceWrapped,
  ]);

  // RSA OID: 1.2.840.113549.1.1.1
  const rsaOid = Buffer.from([
    0x30, 0x0d, 0x06, 0x09, 0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x01,
    0x01, 0x05, 0x00,
  ]);

  const publicKeyInfo = Buffer.concat([rsaOid, bitString]);
  const der = Buffer.concat([
    Buffer.from([0x30]),
    encodeLength(publicKeyInfo.length),
    publicKeyInfo,
  ]);

  const b64 = der.toString('base64');
  const lines = b64.match(/.{1,64}/g).join('\n');
  return `-----BEGIN PUBLIC KEY-----\n${lines}\n-----END PUBLIC KEY-----`;
}

/**
 * Verify a Cognito access token and return its payload.
 * Throws on invalid/expired tokens.
 */
async function verifyAccessToken(token) {
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('Invalid token format');

  const [headerB64, payloadB64, signatureB64] = parts;
  const header = JSON.parse(base64urlDecode(headerB64).toString());
  const payload = JSON.parse(base64urlDecode(payloadB64).toString());

  // Verify token_use is access (not id token)
  if (payload.token_use !== 'access') {
    throw new Error('Not an access token');
  }

  // Verify issuer matches our user pool
  const expectedIssuer = `https://cognito-idp.${AWS_REGION}.amazonaws.com/${COGNITO_USER_POOL_ID}`;
  if (payload.iss !== expectedIssuer) {
    throw new Error('Invalid token issuer');
  }

  // Verify expiration
  if (payload.exp && payload.exp * 1000 < Date.now()) {
    throw new Error('Token expired');
  }

  // Verify signature using JWKS
  const jwks = await getJwks();
  const key = jwks.keys.find((k) => k.kid === header.kid);
  if (!key) throw new Error('Signing key not found');

  const pem = jwkToPem(key);
  const signedContent = `${headerB64}.${payloadB64}`;
  const signature = base64urlDecode(signatureB64);

  const verifier = createVerify('RSA-SHA256');
  verifier.update(signedContent);
  const valid = verifier.verify(pem, signature);

  if (!valid) throw new Error('Invalid token signature');

  return payload;
}

/**
 * Extract the Steam ID from a Cognito access token payload.
 * The username is in format "{steamId}@steam.local".
 */
function extractSteamId(tokenPayload) {
  const username = tokenPayload.username || tokenPayload.sub;
  if (!username) return null;
  // Username format: {steamId}@steam.local
  const match = username.match(/^(\d+)@steam\.local$/);
  return match ? match[1] : null;
}

// ─── Main handler ────────────────────────────────────────────────────────────

export const handler = async (event) => {
  // Handle CORS preflight
  if (event.requestContext?.http?.method === 'OPTIONS') {
    return { statusCode: 204, headers: CORS_HEADERS, body: '' };
  }

  // ── Authenticate ──────────────────────────────────────────────
  const authHeader = event.headers?.authorization || event.headers?.Authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return jsonResponse(401, { error: 'Missing or invalid Authorization header' });
  }

  let tokenPayload;
  try {
    tokenPayload = await verifyAccessToken(authHeader.slice(7));
  } catch (err) {
    console.warn('Token verification failed:', err.message);
    return jsonResponse(401, { error: 'Invalid or expired token' });
  }

  const tokenSteamId = extractSteamId(tokenPayload);
  if (!tokenSteamId) {
    return jsonResponse(401, { error: 'Could not determine Steam ID from token' });
  }

  // ── Validate request ──────────────────────────────────────────
  const params = event.queryStringParameters || {};
  const { action, competitionId, steamId } = params;

  if (!competitionId) {
    return jsonResponse(400, { error: 'Missing competitionId parameter' });
  }

  if (!PARTNER_API_KEY) {
    console.error('PARTNER_API_KEY secret not configured');
    return jsonResponse(500, { error: 'Server configuration error' });
  }

  try {
    if (action === 'register') {
      let driverData;
      try {
        driverData = JSON.parse(event.body || '{}');
      } catch {
        return jsonResponse(400, { error: 'Invalid JSON body' });
      }

      // Enforce: can only register yourself
      if (driverData.steam_id && driverData.steam_id !== tokenSteamId) {
        return jsonResponse(403, { error: 'Cannot register on behalf of another user' });
      }
      driverData.steam_id = tokenSteamId;

      const response = await fetch(
        `${PITVOX_API_URL}/api/v1/competitions/${encodeURIComponent(competitionId)}/register`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Partner-Key': PARTNER_API_KEY,
          },
          body: JSON.stringify(driverData),
        }
      );

      const data = await response.json();
      return jsonResponse(response.status, data);
    }

    if (action === 'withdraw') {
      // Enforce: can only withdraw yourself
      const targetSteamId = steamId || tokenSteamId;
      if (targetSteamId !== tokenSteamId) {
        return jsonResponse(403, { error: 'Cannot withdraw another user' });
      }

      const response = await fetch(
        `${PITVOX_API_URL}/api/v1/competitions/${encodeURIComponent(competitionId)}/register/${encodeURIComponent(targetSteamId)}`,
        {
          method: 'DELETE',
          headers: {
            'X-Partner-Key': PARTNER_API_KEY,
          },
        }
      );

      const data = await response.json();
      return jsonResponse(response.status, data);
    }

    return jsonResponse(400, { error: 'Invalid action. Use "register" or "withdraw".' });
  } catch (error) {
    console.error('Competition proxy error:', error);
    return jsonResponse(502, { error: 'Failed to communicate with PitVox API' });
  }
};
