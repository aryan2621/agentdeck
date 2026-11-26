import { _electron as electron, expect, test } from '@playwright/test'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

// Boots the built app with sandbox + preload on an empty profile and checks the window renders and IPC answers.
test('app launches and the renderer can reach main over IPC', async () => {
  const app = await electron.launch({ args: ['.', `--user-data-dir=${mkdtempSync(join(tmpdir(), 'agentdeck-e2e-'))}`] })
  try {
    const win = await app.firstWindow()
    await expect(win.getByRole('navigation').first()).toBeVisible()
    const settings = await win.evaluate(() => (window as unknown as { api: { getSettings(): Promise<{ theme: string }> } }).api.getSettings())
    expect(settings.theme).toBeTruthy()
    await win.getByRole('button', { name: 'Settings' }).first().click()
    await expect(win.getByRole('heading', { name: 'General' })).toBeVisible()
  } finally { await app.close() }
})
