import { defineFunction, secret } from '@aws-amplify/backend';

export const steamAuth = defineFunction({
  name: 'steam-auth',
  entry: './handler.js',
  runtime: 22,
  timeoutSeconds: 30,
  memoryMB: 256,
  environment: {
    STEAM_API_KEY: secret('STEAM_API_KEY'),
    // ──────────────────────────────────────────────────────────────
    // TODO: Set SITE_URL to your deployed frontend URL.
    //       For local development, leave as http://localhost:5173.
    //       For production, update via `npx ampx sandbox --env` or
    //       set in Amplify console environment variables.
    // ──────────────────────────────────────────────────────────────
    SITE_URL: process.env.SITE_URL || 'http://localhost:5173',
    // Comma-separated Steam IDs that get added to the admins group on login
    ADMIN_STEAM_IDS: process.env.ADMIN_STEAM_IDS || '',
  },
  resourceGroupName: 'auth',
});
