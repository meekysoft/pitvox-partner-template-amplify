import { defineAuth } from '@aws-amplify/backend';

export const auth = defineAuth({
  loginWith: {
    email: true, // Required by Cognito, but users authenticate via Steam
  },
  userAttributes: {
    preferredUsername: {
      required: false,
      mutable: true,
    },
    // Custom attributes for Steam profile data (steam_id, display_name, avatar_url)
    // are configured in backend.js via CloudFormation overrides
  },
  groups: ['admins'],
  // Note: preTokenGeneration trigger is configured manually in backend.js
  // with V2_0 version to enable access token customization
});
