import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  forbidOnly: Boolean(process.env.CI),
  fullyParallel: true,
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  testDir: './apps/web/e2e',
  use: {
    baseURL: 'http://127.0.0.1:4173',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  webServer: {
    command:
      'pnpm --filter @boardnest/web dev --host 127.0.0.1 --port 4173 --strictPort',
    env: {
      VITE_API_URL: 'http://127.0.0.1:4000',
      VITE_GRAPHQL_URL: 'http://127.0.0.1:4000/graphql',
      VITE_WS_URL: 'ws://127.0.0.1:4000/graphql',
    },
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    url: 'http://127.0.0.1:4173',
  },
});
