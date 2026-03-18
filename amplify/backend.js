import { defineBackend } from '@aws-amplify/backend';
import { auth } from './auth/resource.js';
import { steamAuth } from './functions/steam-auth/resource.js';
import { preTokenGeneration } from './functions/pre-token-generation/resource.js';
import { competitionProxy } from './functions/competition-proxy/resource.js';
import { PolicyStatement } from 'aws-cdk-lib/aws-iam';
import { FunctionUrlAuthType } from 'aws-cdk-lib/aws-lambda';
import { Table, AttributeType, BillingMode } from 'aws-cdk-lib/aws-dynamodb';
import { RemovalPolicy } from 'aws-cdk-lib';
import { ServicePrincipal } from 'aws-cdk-lib/aws-iam';

const backend = defineBackend({
  auth,
  steamAuth,
  preTokenGeneration,
  competitionProxy,
});

// =============================================================================
// Steam Auth Lambda Configuration
// =============================================================================

// Grant Steam auth Lambda permission to manage Cognito users
const cognitoPolicy = new PolicyStatement({
  actions: [
    'cognito-idp:AdminGetUser',
    'cognito-idp:AdminCreateUser',
    'cognito-idp:AdminSetUserPassword',
    'cognito-idp:AdminInitiateAuth',
    'cognito-idp:AdminAddUserToGroup',
    'cognito-idp:AdminUpdateUserAttributes',
  ],
  resources: [backend.auth.resources.userPool.userPoolArn],
});

backend.steamAuth.resources.lambda.addToRolePolicy(cognitoPolicy);

// Pass Cognito config to Lambda
backend.steamAuth.addEnvironment(
  'COGNITO_USER_POOL_ID',
  backend.auth.resources.userPool.userPoolId
);
backend.steamAuth.addEnvironment(
  'COGNITO_CLIENT_ID',
  backend.auth.resources.userPoolClient.userPoolClientId
);

// Enable ADMIN_USER_PASSWORD_AUTH flow on the Cognito client
const cfnUserPoolClient = backend.auth.resources.userPoolClient.node.defaultChild;
cfnUserPoolClient.addPropertyOverride('ExplicitAuthFlows', [
  'ALLOW_ADMIN_USER_PASSWORD_AUTH',
  'ALLOW_USER_SRP_AUTH',
  'ALLOW_REFRESH_TOKEN_AUTH',
]);

// Set refresh token validity to 7 days
cfnUserPoolClient.addPropertyOverride('RefreshTokenValidity', 7);
cfnUserPoolClient.addPropertyOverride('TokenValidityUnits', {
  RefreshToken: 'days',
});

// Add custom attributes to Cognito user pool for Steam profile data
const cfnUserPool = backend.auth.resources.userPool.node.defaultChild;

// Configure PreTokenGeneration trigger with V2_0 (required for access token customization)
cfnUserPool.addPropertyOverride('LambdaConfig.PreTokenGenerationConfig', {
  LambdaArn: backend.preTokenGeneration.resources.lambda.functionArn,
  LambdaVersion: 'V2_0',
});

// Grant Cognito permission to invoke the pre-token-generation Lambda
backend.preTokenGeneration.resources.lambda.addPermission('CognitoInvoke', {
  principal: new ServicePrincipal('cognito-idp.amazonaws.com'),
  sourceArn: backend.auth.resources.userPool.userPoolArn,
});

cfnUserPool.addPropertyOverride('Schema', [
  {
    Name: 'email',
    Required: true,
    Mutable: true,
    AttributeDataType: 'String',
  },
  {
    Name: 'steam_id',
    Required: false,
    Mutable: true,
    AttributeDataType: 'String',
    StringAttributeConstraints: {
      MinLength: '1',
      MaxLength: '32',
    },
  },
  {
    Name: 'display_name',
    Required: false,
    Mutable: true,
    AttributeDataType: 'String',
    StringAttributeConstraints: {
      MinLength: '1',
      MaxLength: '128',
    },
  },
  {
    Name: 'avatar_url',
    Required: false,
    Mutable: true,
    AttributeDataType: 'String',
    StringAttributeConstraints: {
      MinLength: '1',
      MaxLength: '512',
    },
  },
]);

// =============================================================================
// Rate Limiting
// =============================================================================

// Create DynamoDB table for rate limiting
const rateLimitTable = new Table(
  backend.steamAuth.resources.lambda.stack,
  'RateLimitTable',
  {
    partitionKey: { name: 'pk', type: AttributeType.STRING },
    billingMode: BillingMode.PAY_PER_REQUEST,
    timeToLiveAttribute: 'ttl',
    removalPolicy: RemovalPolicy.DESTROY,
  }
);

// Grant Steam auth Lambda permission to read/write rate limit table
rateLimitTable.grantReadWriteData(backend.steamAuth.resources.lambda);
backend.steamAuth.addEnvironment('RATE_LIMIT_TABLE', rateLimitTable.tableName);

// =============================================================================
// Public URL for Steam Auth
// =============================================================================

// Create public URL for Steam auth Lambda (used by frontend to initiate login)
const steamAuthUrl = backend.steamAuth.resources.lambda.addFunctionUrl({
  authType: FunctionUrlAuthType.NONE,
});

// =============================================================================
// Competition Proxy Configuration
// =============================================================================

// Pass Cognito config so the Lambda can verify access tokens
backend.competitionProxy.addEnvironment(
  'COGNITO_USER_POOL_ID',
  backend.auth.resources.userPool.userPoolId
);

// Create public URL for competition proxy Lambda
// (registration requests go through this to keep the partner API key server-side;
//  the Lambda validates the Cognito access token before proxying)
const competitionProxyUrl = backend.competitionProxy.resources.lambda.addFunctionUrl({
  authType: FunctionUrlAuthType.NONE,
});

// =============================================================================
// Outputs
// =============================================================================

backend.addOutput({
  custom: {
    steamAuthUrl: steamAuthUrl.url,
    competitionProxyUrl: competitionProxyUrl.url,
  },
});
