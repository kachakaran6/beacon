import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './test',
  testMatch: /.*\.spec\.ts/,
  timeout: 30000,
  retries: 0,
  workers: 1, // Electron single instance testing
  use: {
    trace: 'on-first-retry',
  },
})
