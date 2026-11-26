import { readFileSync, renameSync, writeFileSync } from 'node:fs'
import { isAbsolute } from 'node:path'
import { DEFAULT_SETTINGS, MONO_FONTS, INSTRUCTION_KEYS, LOADOUT_SLOTS, PROVIDERS, parseEnv, type LoadoutSlot, type Preview, type ProviderId, type Settings } from '../shared/types'

let file = ''
let current: Settings = DEFAULT_SETTINGS

const merge = (base: Settings, p: Partial<Settings>): Settings => ({
  ...base, ...p,
  notify: { ...base.notify, ...p.notify },
  cliPaths: { ...base.cliPaths, ...p.cliPaths },
  defaultModels: { ...base.defaultModels, ...p.defaultModels },
  trustedSetups: { ...base.trustedSetups, ...p.trustedSetups },
  repoGit: { ...base.repoGit, ...p.repoGit },
  repoEnv: { ...base.repoEnv, ...p.repoEnv },
  repoPrefs: { ...base.repoPrefs, ...p.repoPrefs },
  repoActions: { ...base.repoActions, ...p.repoActions },
})

export function loadSettings(path: string): void {
  file = path
  try { current = merge(DEFAULT_SETTINGS, JSON.parse(readFileSync(path, 'utf8'))) } catch { current = DEFAULT_SETTINGS } // missing or corrupt: defaults
}
export const getSettings = (): Settings => current
export function setSettings(patch: Partial<Settings>): Settings {
  current = merge(current, patch)
  if (file) {
    try { // atomic: a failed write must not truncate the existing file
      writeFileSync(file + '.tmp', JSON.stringify(current, null, 2))
      renameSync(file + '.tmp', file)
    } catch (e) { console.error('settings not saved:', e) }
  }
  return current
}

/** Branch / remote names we accept from the renderer ('' is allowed separately). */
const REF = /^[A-Za-z0-9][A-Za-z0-9._/-]{0,100}$/
const BOOLS = ['autoRenameBranches', 'renameSessionOnBranch', 'archiveOnMerge', 'automerge', 'optionalChecksBlocking', 'ghStack', 'claudeToolApprovals', 'claudeChrome', 'codeLigatures'] as const
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const strMap = (v: unknown, ok: (s: string) => boolean): Record<string, string> =>
  Object.fromEntries(Object.entries(isObj(v) ? v : {}).filter((e): e is [string, string] => typeof e[1] === 'string' && ok(e[1])))

/** Renderer-supplied patch -> only the keys the renderer may edit, type-checked. Drops trustedSetups. */
export function sanitizeSettings(patch: unknown): Partial<Settings> {
  const p = isObj(patch) ? patch : {}
  const out: Partial<Settings> = {}
  if (p.theme === 'system' || p.theme === 'light' || p.theme === 'dark') out.theme = p.theme
  if (typeof p.colorTheme === 'string' && /^[a-z-]{1,20}$/.test(p.colorTheme)) out.colorTheme = p.colorTheme
  if (typeof p.codeTheme === 'string' && /^[a-z-]{1,20}$/.test(p.codeTheme)) out.codeTheme = p.codeTheme
  for (const k of ['lowContrast', 'seasonal', 'sidebarDiffs'] as const) if (typeof p[k] === 'boolean') out[k] = p[k] as boolean
  if (typeof p.zoom === 'number' && p.zoom >= 50 && p.zoom <= 200) out.zoom = Math.round(p.zoom)
  if (p.accessibleColors === 'default' || p.accessibleColors === 'colorblind') out.accessibleColors = p.accessibleColors
  if (PROVIDERS.some((x) => x.id === p.defaultProvider)) out.defaultProvider = p.defaultProvider as ProviderId
  if (Number.isInteger(p.maxParallel) && (p.maxParallel as number) >= 0 && (p.maxParallel as number) <= 32) out.maxParallel = p.maxParallel as number
  if (typeof p.defaultMode === 'string') out.defaultMode = p.defaultMode as Settings['defaultMode']
  if (isObj(p.notify)) out.notify = Object.fromEntries(Object.entries(p.notify).filter((e) => typeof e[1] === 'boolean')) as Settings['notify']
  if (isObj(p.cliPaths)) out.cliPaths = strMap(p.cliPaths, (s) => s === '' || isAbsolute(s))
  if (isObj(p.defaultModels)) out.defaultModels = strMap(p.defaultModels, () => true)
  if (typeof p.branchPrefix === 'string' && (p.branchPrefix === '' || /^[A-Za-z0-9][A-Za-z0-9._-]{0,29}$/.test(p.branchPrefix))) out.branchPrefix = p.branchPrefix
  if (typeof p.deleteBranchOnArchive === 'boolean') out.deleteBranchOnArchive = p.deleteBranchOnArchive
  if (isObj(p.repoGit)) out.repoGit = Object.fromEntries(Object.entries(p.repoGit).flatMap(([id, v]) => isObj(v) && typeof v.baseBranch === 'string' && typeof v.remote === 'string' && REF.test(v.baseBranch || 'x') && REF.test(v.remote || 'x') ? [[id, { baseBranch: v.baseBranch, remote: v.remote }]] : []))
  if (isObj(p.repoPrefs)) out.repoPrefs = Object.fromEntries(Object.entries(p.repoPrefs).flatMap(([id, v]) => isObj(v) ? [[id, {
    previews: (Array.isArray(v.previews) ? v.previews : []).filter((x): x is Preview => isObj(x) && typeof x.name === 'string' && typeof x.url === 'string' && /^https?:\/\//.test(x.url)).slice(0, 20),
    plainLocalhost: v.plainLocalhost === true, archiveOnMerge: v.archiveOnMerge === true,
    setUpstream: v.setUpstream !== false,
  }]] : []))
  if (isObj(p.repoActions)) out.repoActions = Object.fromEntries(Object.entries(p.repoActions).flatMap(([id, v]) => isObj(v) ? [[id, {
    runMode: v.runMode === 'nonconcurrent' ? 'nonconcurrent' : 'concurrent',
    instructions: Object.fromEntries(INSTRUCTION_KEYS.flatMap(([k]) => isObj(v.instructions) && typeof v.instructions[k] === 'string' ? [[k, (v.instructions[k] as string).slice(0, 5000)]] : [])),
  }]] : []))
  if (Array.isArray(p.sessionOrder)) out.sessionOrder = p.sessionOrder.filter((x): x is string => typeof x === 'string').slice(0, 5000)
  if (Array.isArray(p.hiddenProjects)) out.hiddenProjects = p.hiddenProjects.filter((x): x is string => typeof x === 'string')
  for (const k of ['notifyAgents', 'arrangeManually', 'autoConvertLongText', 'stripAbsolutelyRight', 'caffeinate', 'restartOnUpdate', 'bigTerminal', 'menuBarTray', 'autoMode'] as const) if (typeof p[k] === 'boolean') out[k] = p[k] as boolean
  if (p.sendKey === 'enter' || p.sendKey === 'cmd-enter') out.sendKey = p.sendKey
  if (p.followUp === 'steer' || p.followUp === 'queue') out.followUp = p.followUp
  if (typeof p.completionSound === 'string' && (p.completionSound === '' || /^[A-Za-z]{1,20}$/.test(p.completionSound) || (isAbsolute(p.completionSound) && p.completionSound.startsWith(soundsDir())))) out.completionSound = p.completionSound
  if (typeof p.env === 'string' && p.env.length < 20000) out.env = p.env
  if (isObj(p.repoEnv)) out.repoEnv = strMap(p.repoEnv, (s) => s.length < 20000)
  if (typeof p.worktreesDir === 'string' && (p.worktreesDir === '' || isAbsolute(p.worktreesDir))) out.worktreesDir = p.worktreesDir
  if (p.branchPrefixMode === 'github' || p.branchPrefixMode === 'custom' || p.branchPrefixMode === 'none') out.branchPrefixMode = p.branchPrefixMode
  for (const k of BOOLS) if (typeof p[k] === 'boolean') out[k] = p[k] as boolean
  if (p.codexApprovals === 'default' || p.codexApprovals === 'untrusted' || p.codexApprovals === 'never') out.codexApprovals = p.codexApprovals
  if (p.markdownStyle === 'default' || p.markdownStyle === 'serif' || p.markdownStyle === 'compact') out.markdownStyle = p.markdownStyle
  if (typeof p.monoFont === 'string' && MONO_FONTS.includes(p.monoFont)) out.monoFont = p.monoFont
  if (typeof p.terminalFont === 'string' && /^[\w .-]{0,60}$/.test(p.terminalFont)) out.terminalFont = p.terminalFont.trim()
  if (Number.isInteger(p.terminalFontSize) && (p.terminalFontSize as number) >= 8 && (p.terminalFontSize as number) <= 24) out.terminalFontSize = p.terminalFontSize as number
  if (Array.isArray(p.loadout)) out.loadout = p.loadout.filter((x): x is LoadoutSlot => isObj(x) && PROVIDERS.some((q) => q.id === x.provider) && typeof x.model === 'string').slice(0, LOADOUT_SLOTS)
  return out
}
/** Where "Add sound..." copies files; set once at startup. */
let sounds = ''
export const setSoundsDir = (d: string): void => { sounds = d }
export const soundsDir = (): string => sounds || '\0'
/** Global env, then the project's (project wins), for terminals, setup scripts and agents. */
export const userEnv = (projectId?: string): Record<string, string> => ({ ...parseEnv(current.env), ...(projectId ? parseEnv(current.repoEnv[projectId] ?? '') : {}) })
/** The user's configured binary for a provider, else its bare command name (resolved on PATH). */
export const cliPath = (id: ProviderId, fallback: string): string => current.cliPaths[id]?.trim() || fallback
