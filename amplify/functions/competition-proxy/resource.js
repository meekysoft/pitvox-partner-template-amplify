import { defineFunction, secret } from '@aws-amplify/backend';

export const competitionProxy = defineFunction({
  name: 'competition-proxy',
  entry: './handler.js',
  runtime: 22,
  timeoutSeconds: 15,
  memoryMB: 128,
  environment: {
    // ──────────────────────────────────────────────────────────────
    // TODO: Set your PitVox partner API key as an Amplify secret:
    //       npx ampx sandbox secret set PARTNER_API_KEY
    // ──────────────────────────────────────────────────────────────
    PARTNER_API_KEY: secret('PARTNER_API_KEY'),
    PITVOX_API_URL: process.env.PITVOX_API_URL || 'https://api.pitvox.com',
    // COGNITO_USER_POOL_ID is set in backend.js after the user pool is created
  },
});
