import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './test/e2e',
  workers: 1,
  use: {
    baseURL: 'http://127.0.0.1:3000',
    trace: 'on-first-retry'
  },
  projects: [
    {
      name: 'desktop',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1440, height: 1200 }
      }
    },
    {
      name: 'mobile',
      use: {
        ...devices['Pixel 7'],
        viewport: { width: 390, height: 1000 }
      }
    }
  ],
  webServer: {
    command: 'npm run dev -- --hostname 127.0.0.1 --port 3000',
    url: 'http://127.0.0.1:3000',
    reuseExistingServer: false,
    env: {
      ALLOW_DEMO_SNAPSHOT: 'true',
      PREDICTARENA_LOCAL_STORE_PATH: '/tmp/predictarena-playwright-store.json',
      PROOF_MODE_SECRET: 'playwright-proof-secret',
      PROOF_SMOKE_MAX_STAKE_USDC6: '50000',
      PROOF_SMOKE_MAX_DAILY_USDC6: '100000',
      PROOF_SMOKE_MAX_TRANSACTIONS_PER_DAY: '2'
    }
  }
});
