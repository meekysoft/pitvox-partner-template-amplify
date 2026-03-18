/**
 * Rate Limiting for Steam Auth
 *
 * Uses DynamoDB atomic counters with TTL for automatic cleanup.
 * Prevents abuse of the authentication endpoint.
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  UpdateCommand,
} from '@aws-sdk/lib-dynamodb';

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

// Rate limit configuration
const RATE_LIMIT_CONFIG = {
  // Per-IP limits for login requests
  loginRequestsPerMinute: 5,
  loginRequestsPerHour: 20,
  // Callback limits (slightly higher since these come from Steam)
  callbackRequestsPerMinute: 10,
  callbackRequestsPerHour: 30,
};

const MINUTE = 60;
const HOUR = 3600;

/**
 * Extract client IP from Lambda event
 */
export function getClientIp(event) {
  const forwardedFor = event.headers?.['x-forwarded-for'];
  if (forwardedFor) {
    return forwardedFor.split(',')[0].trim();
  }
  return event.requestContext?.http?.sourceIp || 'unknown';
}

/**
 * Check and update rate limit for a given key
 */
async function checkRateLimit(key, limit, windowSeconds) {
  const tableName = process.env.RATE_LIMIT_TABLE;
  if (!tableName) {
    console.warn('RATE_LIMIT_TABLE not configured, skipping rate limit check');
    return { allowed: true, current: 0, limit, resetIn: 0 };
  }

  const now = Math.floor(Date.now() / 1000);
  const windowStart = Math.floor(now / windowSeconds) * windowSeconds;
  const ttl = windowStart + windowSeconds + 60;

  const windowKey = `${key}:${windowStart}`;

  try {
    const result = await docClient.send(
      new UpdateCommand({
        TableName: tableName,
        Key: { pk: windowKey },
        UpdateExpression:
          'SET #count = if_not_exists(#count, :zero) + :inc, #ttl = :ttl',
        ExpressionAttributeNames: {
          '#count': 'count',
          '#ttl': 'ttl',
        },
        ExpressionAttributeValues: {
          ':inc': 1,
          ':zero': 0,
          ':ttl': ttl,
        },
        ReturnValues: 'ALL_NEW',
      })
    );

    const current = result.Attributes?.count || 1;
    const resetIn = windowStart + windowSeconds - now;

    return {
      allowed: current <= limit,
      current,
      limit,
      resetIn,
    };
  } catch (error) {
    console.error('Rate limit check failed:', error);
    // Fail open — allow request if rate limiting fails
    return { allowed: true, current: 0, limit, resetIn: 0 };
  }
}

/**
 * Check all rate limits for a request
 */
export async function checkRateLimits(ip, action) {
  const config = RATE_LIMIT_CONFIG;
  const prefix = `ip:${ip}:${action}`;

  // Check per-minute limit
  const minuteKey = `${prefix}:minute`;
  const minuteLimit =
    action === 'login'
      ? config.loginRequestsPerMinute
      : config.callbackRequestsPerMinute;
  const minuteResult = await checkRateLimit(minuteKey, minuteLimit, MINUTE);

  if (!minuteResult.allowed) {
    return {
      allowed: false,
      reason: `Too many requests. Limit: ${minuteLimit} per minute.`,
      retryAfter: minuteResult.resetIn,
    };
  }

  // Check per-hour limit
  const hourKey = `${prefix}:hour`;
  const hourLimit =
    action === 'login'
      ? config.loginRequestsPerHour
      : config.callbackRequestsPerHour;
  const hourResult = await checkRateLimit(hourKey, hourLimit, HOUR);

  if (!hourResult.allowed) {
    return {
      allowed: false,
      reason: `Too many requests. Limit: ${hourLimit} per hour.`,
      retryAfter: hourResult.resetIn,
    };
  }

  return { allowed: true };
}

/**
 * Generate a rate limit exceeded response
 */
export function rateLimitResponse(reason, retryAfter, frontendUrl) {
  if (frontendUrl) {
    return {
      statusCode: 302,
      headers: {
        Location: `${frontendUrl}/auth/error?code=rate_limited`,
        'Retry-After': String(retryAfter),
      },
      body: '',
    };
  }

  return {
    statusCode: 429,
    headers: {
      'Content-Type': 'application/json',
      'Retry-After': String(retryAfter),
    },
    body: JSON.stringify({
      error: 'Too Many Requests',
      message: reason,
      retryAfter,
    }),
  };
}
