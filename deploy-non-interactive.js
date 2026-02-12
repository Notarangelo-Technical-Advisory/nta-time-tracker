#!/usr/bin/env node
/**
 * Non-Interactive Firebase Deployment with ADC
 *
 * Uses Application Default Credentials (ADC) for authentication.
 * Run `gcloud auth application-default login` for local development.
 */

const { GoogleAuth } = require('google-auth-library');
const { execSync } = require('child_process');

const PROJECT_ID = 'fta-invoice-tracking';

async function deploy() {
  console.log('Authenticating...\n');

  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

  let authMethod = 'unknown';

  try {
    const auth = new GoogleAuth({
      scopes: [
        'https://www.googleapis.com/auth/cloud-platform',
        'https://www.googleapis.com/auth/firebase'
      ]
    });

    await auth.getClient();
    authMethod = 'ADC';
    console.log('Using Application Default Credentials\n');

    const client = await auth.getClient();
    const accessToken = await client.getAccessToken();

    if (!accessToken || !accessToken.token) {
      throw new Error('Failed to obtain access token');
    }

    console.log('Deploying to Firebase...\n');

    execSync(
      `npx firebase-tools deploy --project ${PROJECT_ID} --token "${accessToken.token}"`,
      {
        stdio: 'inherit',
        env: process.env
      }
    );

    console.log('\nDeployment successful!');
    console.log(`Site: https://${PROJECT_ID}.web.app\n`);

  } catch (error) {
    console.error('\nDeployment failed!');
    console.error('Error:', error.message);
    console.error('\nTroubleshooting:');
    console.error('1. Run `gcloud auth application-default login` for local ADC');
    console.error('2. For CI/CD: configure Workload Identity Federation');
    console.error('');
    process.exit(1);
  }
}

deploy();
