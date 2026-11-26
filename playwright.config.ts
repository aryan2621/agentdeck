import { defineConfig } from '@playwright/test'

// Runs against the built app (`npm run build:e2e` first); the .e2e.ts suffix keeps vitest from picking it up.
export default defineConfig({ testDir: 'e2e', testMatch: '*.e2e.ts', timeout: 30_000 })
