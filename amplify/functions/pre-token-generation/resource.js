import { defineFunction } from '@aws-amplify/backend';

export const preTokenGeneration = defineFunction({
  name: 'pre-token-generation',
  entry: './handler.js',
  runtime: 22,
  resourceGroupName: 'auth',
});
