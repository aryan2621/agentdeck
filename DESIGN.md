# AgentDeck design spec

Implementation spec for the AgentDeck renderer. Source of truth for tokens is `src/renderer/src/assets/app.css`; this file documents it and marks every proposal.

**Legend:** `LIVE` = in the code today. `NEW` = proposed, not built. Hex values are computed from the OKLCH tokens (sRGB, clipped); OKLCH is authoritative.

## 0. Assumptions and deviations

Stack as built: Electron 44, React 19, Tailwind v4 (`@theme inline`), Radix, cva, cmdk, shiki, xterm 6, lucide-react, SF Pro (system stack) + Geist Mono Variable, vitest. Dark and light follow `prefers-color-scheme`.

| Brief asked for | This spec uses | Why |
|---|---|---|
| SF Pro/Inter + JetBrains Mono | SF Pro via the system font stack + Geist Mono | Matches the Grok Bot reference. SF Pro exists only on macOS; other platforms fall back to `system-ui`. Inter stays banned. |
| Vibrancy / backdrop blur | Flat neutral surface ladder | No blur or glass. |
| Radii | 4 / 6 / 8px; full only for dots, avatars and progress | Quiet native: 6px buttons, tabs, badges, inputs and selects; 8px composer, dialogs and menus. |
| Framer Motion, Zustand | CSS transitions, existing `store.ts` | Nothing here needs either. |
| Monaco diff | shiki + own `Diff.tsx` | Already in use, lighter. |
| Card grid for sessions | Sidebar list and 72px avatar rail | Grok Bot layout; the Grid view was removed. |
| Blue running, violet plan, red-orange full access | Neutral accent; amber only for needs-you; red for errors and Full access | One accent rule. Running is a spinner (shape), not a hue. Plan/Full access are labelled by text. |
| 10 project hues | 8 (`--project-0..7`) | What the code ships; 45° steps are already as distinct as sRGB allows at this chroma. |

Honesty rules from the README, enforced in copy: cost and limits are **estimates**; Full access is **never** called safe or sandboxed.

## 1. Principles

1. **Needs-you wins.** Anything waiting on a human outranks everything else: sort order, colour, dock badge.
2. **Quiet by default.** Pure neutral greys (black is the primary action) plus one status colour. Colour means state or project, never decoration.
3. **Shape plus colour.** Every status has a distinct glyph; colour is never the only signal.
4. **Keyboard first.** Every action has a key path; ⌘ shortcuts work everywhere, bare keys only inside their widget.
5. **Soft, native.** 6px buttons, rounded bubbles (user black on the right, agent grey on the left), 13px body, borders not shadows, 120ms ease-out. Sidebar rows are a 32px avatar plus title, age and a one-line preview.
6. **Say what is true.** Estimates labelled, risk stated plainly, errors name the fix.

## 2. Tokens

### 2.1 Surfaces and text (LIVE)

Ladder: chrome < background < panel < overlay. Warm neutrals, OKLCH hue 75.

| Token | Dark OKLCH | Dark hex | Light OKLCH | Light hex |
|---|---|---|---|---|
| `--chrome` (window, sidebar) | 0.15 0.004 75 | `#0c0b09` | 0.945 0.005 75 | `#efece9` |
| `--background` (work surface) | 0.18 0.004 75 | `#131110` | 0.985 0.003 75 | `#fbfaf8` |
| `--panel` / `--card` | 0.215 0.004 75 | `#1b1917` | 0.965 0.004 75 | `#f5f3f0` |
| `--overlay` (menus, dialogs) | 0.25 0.005 75 | `#23211f` | 1 0 0 | `#ffffff` |
| `--muted` | 0.25 0.004 75 | `#232120` | 0.93 0.005 75 | `#eae7e4` |
| `--foreground` | 0.95 0.004 75 | `#f0eeeb` | 0.2 0.005 75 | `#171614` |
| `--muted-foreground` | 0.72 0.006 75 | `#a7a4a0` | 0.45 0.006 75 | `#575552` |
| `--faint` | 0.63 0.006 75 | `#8b8985` | 0.47 0.006 75 | `#5d5a57` |
| `--primary` (inverted fg) | 0.95 0.004 75 | `#f0eeeb` | 0.2 0.005 75 | `#171614` |
| `--ring` (focus) | 0.78 0.01 75 | `#bbb7b0` | 0.35 0.01 75 | `#3e3a35` |
| `--border` | white 7% | | black 8% | |
| `--input` (control border) | white 13% | | black 16% | |
| `--accent` (hover fill) | white 6% | | black 5.5% | |

### 2.2 Status (LIVE colours, NEW triplets)

| Status | Token | Dark | Light | Glyph |
|---|---|---|---|---|
| needs-you | `--warn` / `needs` | `#f7b83d` (0.82 0.15 80) | `#a45f00` (0.55 0.14 70) | filled dot + ring |
| ok / approved | `--ok` | `#7ccd8e` (0.78 0.12 150) | `#21763c` (0.5 0.12 150) | check |
| error / deny / Full access | `--destructive` | `#f47a79` (0.72 0.15 22) | `#c92f33` (0.55 0.19 25) | X |
| working | `--foreground` | | | spinner |
| idle | `--faint` | | | dash |
| done | `--faint` | | | check |

NEW: tinted fills for banners and chips, built with Tailwind opacity on the same tokens, no new variables: bg `/10`, border `/40`, text at full token. Example: `border-warn/40 bg-warn/10 text-warn` (the approval card already uses `border-warn/40`).

Diff: `--add` = ok at 13–14% alpha, `--del` = destructive at 12–15% alpha. NEW word-level highlight: same hue at 28% alpha on the changed span.

### 2.3 Project hues (LIVE)

`projectColor(id)` hashes the id to `--project-0..7` (`lib/projectColor.ts`). Fills the 32px session avatar (`Avatar.tsx`); never text.

| # | Hue | Dark `0.72 0.12 h` | Light `0.58 0.13 h` |
|---|---|---|---|
| 0 | 30 | `#e68677` | `#bb584a` |
| 1 | 70 | `#d49648` | `#aa6a00` |
| 2 | 110 | `#a9ab4a` | `#808000` |
| 3 | 155 | `#60bb83` | `#249057` |
| 4 | 195 | `#16bbbc` | `#009192` |
| 5 | 235 | `#4cb0e5` | `#0085bc` |
| 6 | 275 | `#8f9eef` | `#6572c6` |
| 7 | 330 | `#cf88c8` | `#a45b9f` |

### 2.4 Contrast (computed, WCAG 2.x)

Against background / panel / overlay / chrome.

| Pair | Dark | Light |
|---|---|---|
| foreground | 16.3 / 15.1 / 13.8 / 17.0 | 17.3 / 16.4 / 18.1 / 15.4 |
| muted-foreground | 7.6 / 7.1 / 6.5 / 7.9 | 7.1 / 6.7 / 7.4 / 6.3 |
| faint | 5.4 / 5.0 / 4.6 / 5.6 | 6.5 / 6.2 / 6.8 / 5.8 |
| ok | 9.8 / 9.2 / 8.4 / 10.3 | 5.4 / 5.1 / 5.7 / 4.8 |
| warn | 10.6 / 9.9 / 9.0 / 11.1 | 4.8 / **4.50** / 5.0 / **4.24** |
| destructive | 7.1 / 6.6 / 6.0 / 7.4 | 5.1 / 4.8 / 5.4 / 4.55 |

Findings:
- All text tokens pass 4.5:1 except **light `warn` on `chrome` (4.24)**. Rule: never set warn text directly on chrome in light; use it on background/overlay or as a glyph (3:1 suffices for non-text).
- Project hues are swatches (need 3:1): light hues 3.3–4.6 on chrome, 3.4–4.6 on background. Hues 3 and 4 (green, teal) are the weakest in light (3.4 on chrome); they are always paired with the project name, so colour is never the only cue.

### 2.5 Type (LIVE)

| Token | Size / line | Use |
|---|---|---|
| `text-meta` | 11 / 1.4 | column headers, kbd, timestamps |
| `text-small` | 12 / 1.5 | secondary, mono detail |
| `text-body` | 13 / 1.5 | default UI |
| `text-prose` | 14 / 1.6 | agent messages |
| `text-title` | 16 / 1.4, 600 | dialog titles |
| `text-page` | 20 / 1.3, 600, -0.01em | page headings |

Sans SF Pro via the system stack (`-apple-system, BlinkMacSystemFont, 'SF Pro Text', system-ui`), mono `Geist Mono Variable`. Numbers in tables use `.tnum`.

### 2.6 Radius, shadow, spacing, motion, z-index

- Radius: `sm` 4 (rows, inputs), `md` 6 (cards, menus), `lg` 8 (dialogs). Nothing larger; `rounded-full` only for dots and meters.
- Shadow: one, `--shadow-overlay` = `0 8px 24px rgba(0,0,0,.40)` dark / `.12` light, overlays only. Everything else is a border.
- Spacing: 4px grid. Row height 32px (`h-8`); control height 28px (`h-7`); sidebar width as built in `App.tsx`.
- Motion: 120ms ease-out on every state change (global rule in `app.css`). NEW scale: 80ms hover, 120ms default, 150ms overlays (tw-animate `fade-in` / `zoom-in-95`). `prefers-reduced-motion` disables all (LIVE). Only looping animation: `pulse-text` 1.8s on the "working" label.
- NEW z-index: base 0, sticky headers 10, popovers/menus 50 (as in `select.tsx`), dialog 50, toast 60.

### 2.7 Tailwind (v4, LIVE form)

```css
@theme inline {
  --color-background: var(--background);
  --color-chrome: var(--chrome);
  --color-panel: var(--panel);
  --color-overlay: var(--overlay);
  --color-foreground: var(--foreground);
  --color-muted-foreground: var(--muted-foreground);
  --color-faint: var(--faint);
  --color-border: var(--border);
  --color-ok: var(--ok);
  --color-warn: var(--warn);
  --color-needs: var(--warn);
  --color-destructive: var(--destructive);
  --font-sans: -apple-system, BlinkMacSystemFont, 'SF Pro Text', system-ui, sans-serif;
  --font-mono: 'Geist Mono Variable', ui-monospace, 'SF Mono', Menlo, monospace;
  --radius-sm: 4px; --radius-md: 6px; --radius-lg: 8px; --radius-xl: 12px; --radius-2xl: 16px; --radius-3xl: 24px;
  --text-body: 13px; --text-body--line-height: 1.5;
}
```

### 2.8 Terminal palette (built, for xterm)

Terminal theme is set in `Terminal.tsx`. Proposed ANSI mapping from existing tokens so it follows the scheme: background `--panel`, foreground `--foreground`, cursor `--primary`, selection `--accent`; red `--destructive`, green `--ok`, yellow `--warn`, blue project-5, magenta project-7, cyan project-4; bright variants raise L by 0.06. Resolve CSS variables with `getComputedStyle` at mount and on scheme change.

## 3. Typography rules

- One sans family. Weights 400 and 500 in UI, 600 only for title/page.
- Mono for: branch names, file paths, commands, provider ids, kbd.
- Sentence case everywhere. No uppercase labels, no eyebrows.
- Truncate with `truncate` and a `title`/tooltip for the full value; never wrap rows.

## 4. Iconography

lucide-react only, `size-3.5` (14px) in rows and buttons, `size-4` in headers, stroke default. An icon either labels an action (with text or a tooltip) or encodes a status (with `aria-label`). No decorative icons. Status glyphs: spinner `Loader2`, check `Check`, X `X`, dash `h-px w-2`, needs-you dot with ring.

## 5. Layout

```
+---------+-----------------------------------------------+
| Sidebar | SessionView header: title · project · mode chip|
| projects|-----------------------------------------------|
| + search| Transcript (virtual list)        | Changes tab |
| + Limits|                                  | (DiffPanel) |
|         |-----------------------------------------------|
|         | Composer                                       |
+---------+-----------------------------------------------+
```

- Sidebar on `chrome`, work area on `background`, raised surfaces on `panel`, floating on `overlay`.
- Rail: ⌘B collapses the sidebar to a 72px avatar rail (`Sidebar.tsx`, `rail`), with an unread dot per session.
- NEW ⌘B toggles the rail (grid-cols toggle in `App.tsx`, persisted in `localStorage`). New session and Add project are separate round buttons.
- Minimum window width as configured in `src/main/index.ts`; below it the Changes tab overlays instead of splitting.

## 6. Components

Map of what exists. `ui/*` are the house primitives; reuse them, do not add parallel ones.

| Component | File | State |
|---|---|---|
| Button, Badge, Kbd, Tip, Row, Select, Menu, Tabs, Dialog, ConfirmDialog, Field, Input, Checkbox, Disclosure | `components/ui/*` | LIVE |
| StatusDot / StatusBadge | `components/StatusBadge.tsx` | LIVE |
| SessionRow | `Sidebar.tsx` (list) | LIVE |
| PermissionRequestCard | `ApprovalCard.tsx` | LIVE |
| UsageMeter | `Limits.tsx` | LIVE (needs estimate label) |
| Command palette | `Palette.tsx` (cmdk) | LIVE |
| Diff, DiffPanel | `Diff.tsx`, `DiffPanel.tsx` | LIVE |
| Terminal | `Terminal.tsx` | LIVE |
| ModeSelector | `NewSessionForm.tsx:69` uses `Select` inline | NEW component |
| Banner (missing CLI / gh) | none | NEW |
| WorktreeSetupProgress | none | NEW |
| CheckpointTimeline / rewind file list | `SessionView.tsx:109` label only | NEW |
| ShortcutCheatsheet, ErrorState, Onboarding | none | NEW (deferred) |

Skeletons below use the real APIs (`cn`, `Badge`, `Button`, `Kbd`, `Tip`, `Select`, `projectColor`, `MODES`, `MODE_LABEL`).

### 6.1 StatusDot (LIVE, `StatusBadge.tsx`)

| State | Size | Glyph | Colour | Motion |
|---|---|---|---|---|
| needs-you | 14px box, 8px dot, 2px ring at 30% | dot + ring | `needs` | none |
| working | 14px | `Loader2` | `foreground` | spin |
| done | 14px | `Check` | `faint` | none |
| error | 14px | `X` | `destructive` | none |
| idle | 14px | 8x1px dash | `faint` | none |

```tsx
export function StatusDot({ status }: { status: SessionStatus }) {
  const label = LABEL[status]
  const box = 'flex size-3.5 shrink-0 items-center justify-center'
  if (status === 'needs-you') return <span className={box} role="img" aria-label={label}><span className="size-2 rounded-full bg-needs ring-2 ring-needs/30" /></span>
  if (status === 'working') return <Loader2 className="size-3.5 shrink-0 animate-spin text-foreground" role="img" aria-label={label} />
  // done, error, idle as in StatusBadge.tsx
}
```

### 6.2 SessionRow (LIVE, `Sidebar.tsx`)

32px, `rounded-none` inside the table, `Row` hover/active style, roving `tabIndex`, `role="row"` with `role="cell"` children, 8px project swatch.

```tsx
<Row role="row" tabIndex={idx === cur ? 0 : -1} onClick={() => actions.select(s.id)} onFocus={() => setCur(idx)}
     className={cn(COLS, 'h-8 items-center rounded-none text-foreground')}>
  <StatusDot status={s.status} />
  <span className="truncate" role="cell">{s.title}</span>
  <span className="flex items-center gap-1.5 truncate text-muted-foreground" role="cell">
    <span className="size-2 shrink-0 rounded-[2px]" style={{ background: projectColor(p.id) }} aria-hidden />{p.name}
  </span>
  <span className="font-mono text-small text-muted-foreground" role="cell">{s.provider}</span>
  <span className="truncate font-mono text-small text-faint" role="cell">{s.branch ?? '—'}</span>
  <span className="tnum text-right text-meta text-faint" role="cell">{ago(s.createdAt)}</span>
</Row>
```

States: hover `bg-accent`; selected `aria-current` + `bg-accent`; focus-visible 2px ring. Sidebar rows use the same `Row`.

### 6.3 PermissionRequestCard (LIVE, `ApprovalCard.tsx`)

- Container: `rounded-md border border-warn/40 bg-panel px-3 py-2.5`, `role="group"`, auto-focus when pending.
- Header: `ShieldAlert` (warn), "Approval needed", mono kind (`command | edit | other`).
- Body: summary in `bg-chrome` mono block; details in a `Disclosure`.
- Actions: **Approve** `Y` (default), **Always allow** (tooltip: "Stop asking for this kind of action in this session"), **Deny** `N` (destructive).
- After decision: `Badge` ok/danger, controls removed.
- Y/N only fire while focus is inside the card. Never bind approve-all.

### 6.4 ModeSelector (NEW)

Reuses `Select`, `MODES`, `MODE_LABEL`. Full access gets destructive text and a one-line honest description. In an existing session the mode is shown read-only (main has no mid-session change), as a header chip.

```tsx
// components/ModeSelector.tsx
import { Select } from './ui/select'
import { Badge } from './ui/badge'
import { MODES, MODE_LABEL } from '../lib/modes'
import type { PermissionMode } from '../../../shared/types'

export const MODE_HINT: Record<PermissionMode, string> = {
  supervised: 'Asks before every edit and command.',
  'auto-edit': 'Edits files without asking; still asks for commands.',
  'full-access': 'Runs anything without asking. Not a sandbox.',
  plan: 'Read-only. The agent proposes before acting.',
}

export function ModeSelector({ value, onChange }: { value: PermissionMode; onChange: (m: PermissionMode) => void }) {
  return (
    <div className="flex flex-col gap-1">
      <Select label="Permission mode" value={value} onChange={(v) => onChange(v as PermissionMode)}
        options={MODES.map((m) => ({ value: m, label: MODE_LABEL[m] }))}
        className={value === 'full-access' ? 'border-destructive/50 text-destructive' : undefined} />
      <p className={value === 'full-access' ? 'text-small text-destructive' : 'text-small text-faint'}>{MODE_HINT[value]}</p>
    </div>
  )
}

export const ModeChip = ({ mode }: { mode: PermissionMode }) =>
  mode === 'full-access' ? <Badge tone="danger">Full access</Badge> : null
```

Plan mode is Claude-only (types.ts note): disable the option for other providers.

### 6.5 UsageMeter (LIVE, `Limits.tsx`; label change NEW)

Currently "N% left" with bar `h-1`, `bg-primary`, turns `bg-destructive` under 20%. Spec: 4px bar, `rounded-full`, `role="progressbar"` with `aria-valuenow`, plus text, so colour is never alone. NEW: header reads "Usage limits · estimate"; each value stays "N% left".

```tsx
<div className="flex flex-col gap-1">
  <div className="flex justify-between"><span className="truncate">{r.text}</span><span className="tnum text-muted-foreground">{r.pct}% left</span></div>
  <div className="h-1 overflow-hidden rounded-full bg-muted" role="progressbar" aria-label={`${r.text} remaining`} aria-valuenow={r.pct} aria-valuemin={0} aria-valuemax={100}>
    <div className={cn('h-full rounded-full', r.pct < 20 ? 'bg-destructive' : 'bg-primary')} style={{ width: `${r.pct}%` }} />
  </div>
</div>
```

Cost on sessions is labelled "est." wherever shown.

### 6.6 Banner (NEW)

```tsx
const TONE = { warn: 'border-warn/40 bg-warn/10', danger: 'border-destructive/40 bg-destructive/10' }
export function Banner({ tone = 'warn', children, action }: { tone?: keyof typeof TONE; children: React.ReactNode; action?: React.ReactNode }) {
  return <div role="alert" className={cn('flex items-center gap-2 rounded-md border px-3 py-2 text-body', TONE[tone])}>{children}{action && <span className="ml-auto">{action}</span>}</div>
}
```

Text stays `foreground` (contrast), tint carries tone.

## 7. Status system

LIVE union (`src/shared/types.ts:20`): `idle | working | needs-you | done | error`.

Priority for sorting, dock badge and ⌘J: needs-you > error > working > idle > done.

| Status | Sidebar | Dock | Notification |
|---|---|---|---|
| needs-you | dot + ring, group "Needs you" first | counts toward badge | yes, when window unfocused |
| working | spinner, "Running" | no | no |
| error | X | no | yes |
| done | check, faint | no | optional |
| idle | dash | no | no |

NEW (proposed, not built): `rate-limited` status (amber clock glyph, "Resets at HH:MM"); `needs-you` split into permission vs question; archived as a real flag instead of the cast at `sessions.ts:286`.

## 8. Flows

Each: steps · microcopy · edge cases · state.

1. **First run / sign-in.** Settings > Accounts; sign in per provider. Copy: "Sign in to Claude to start sessions." Edge: CLI missing. State: partial; no onboarding (NEW, deferred).
2. **Add project.** `pickFolder`, name from folder, hue from id. Edge: not a git repo disables worktree option. LIVE.
3. **New session (⌘N).** Project, provider, mode, prompt, worktree option; ⌘↵ submits. Edge: setup script failure currently a toast only. Gap: progress stream (Part B step 8).
4. **Worktree + setup.** Copy: "Creating worktree… Running setup script…" with streamed output; failure: "Setup failed. Open the log or skip setup." Gap.
5. **Approval.** Card auto-focuses; Y/N/Always. Copy: "Approval needed". Edge: session left while pending keeps `needs-you` and the dock badge. LIVE.
6. **Mode choice.** Chosen at creation; Full access shows "Runs anything without asking. Not a sandbox." and a persistent red chip. Gap (Part B step 2).
7. **Review changes.** Changes tab: Uncommitted / Branch-vs-base, commit, push, `gh pr create`. Edge: `gh` missing → Banner "GitHub CLI not found. Install `gh` to open pull requests." Gap: split view, stage/unstage, generated message (deferred).
8. **Rewind.** Confirm dialog; copy: "Restore files to this checkpoint? N files will change." with list. Gap: file list (Part B step 6).
9. **Limits.** Meter turns destructive under 20%; alert suggests switching account. Copy "estimate". Partial.
10. **Quit with running agents.** Native dialog: "Agents stop when AgentDeck quits." Buttons: Quit / Cancel. Gap (Part B step 4).

## 9. Motion

- 120ms ease-out on colour/background/opacity for interactive elements (global).
- Overlays: tw-animate fade-in + zoom-in-95, 150ms.
- Spinner for working; `pulse-text` 1.8s on the working label only.
- No layout-shifting animation. Reduced motion removes all (LIVE).

## 10. Shortcuts (built; list lives in lib/shortcuts.ts)

| Keys | Action | State |
|---|---|---|
| ⌘K | Command palette | LIVE (`Palette.tsx:21`) |
| ⌘N | New session | LIVE |
| ⌘1–9 | Jump to session n | LIVE |
| ⌘↵ | Submit new-session form | LIVE |
| Enter | Send message | LIVE (`Composer.tsx:117`) |
| Y / N | Approve / deny (card focused) | LIVE |
| ↑ ↓ | Move in transcript / approval choices | LIVE |
| ⌘B | Toggle sidebar | NEW |
| ⌘J | Jump to next needs-you session | NEW |

No approve-all shortcut, by design. Focus rule: when xterm has focus, ⌘ chords pass through to the app, bare keys go to the terminal. NEW: native menu accelerators mirror the table.

## 11. Accessibility

- 4.5:1 for text (see 2.4 for the one light-theme exception and its rule); 3:1 for glyphs and swatches.
- Visible focus: `outline-2 outline-offset-1 outline-ring` globally; `focus-visible` only.
- Roles: table → `table/row/cell/columnheader/rowgroup`; approval card `group` with label; meters `progressbar` with `aria-valuenow`; status glyphs `img` with `aria-label`; alerts `role="alert"`.
- Never colour alone: every status has a glyph and a label; project colour always sits next to the name.
- Keyboard path for every action; Radix handles menus, selects and dialogs (focus trap, Esc).
- Reduced motion honoured.
- Targets: rows 32px, controls 28px (desktop pointer; acceptable).

## 12. Resources

- Apple Human Interface Guidelines (macOS): developer.apple.com/design/human-interface-guidelines
- Radix Primitives: radix-ui.com/primitives
- cmdk: github.com/pacocoursey/cmdk
- xterm.js: xtermjs.org
- shiki: shiki.style
- Lucide: lucide.dev
- Geist: vercel.com/font
- OKLCH: oklch.com
- WCAG 2.2 contrast: w3.org/TR/WCAG22

## 13. Implementation handoff

Build order (smallest first; each step is its own checkpoint). Gaps are defined by the sections above.

1. Honest labels: "estimate" on Limits and cost; "Not a sandbox" in the Full access description.
2. `ModeSelector` + Full access chip in the `SessionView` header (read-only).
3. ⌘B and ⌘J in the `Palette.tsx` keydown handler.
4. Quit warning in `src/main/index.ts` `before-quit`.
5. Native app menu (`Menu.buildFromTemplate`) over the existing IPC event channel.
6. File list in the rewind dialog.
7. `which` check for CLIs and `gh`, `Banner` in `DiffPanel` and Settings.
8. Worktree setup progress streamed from `sessions.ts` into `NewSessionForm`.

Deferred: onboarding, window-state persistence, split diff / stage / generated commit message, `rate-limited` status, question-vs-permission split, context menus.

Per step, from `agentdeck/`: `npx tsc --noEmit -p tsconfig.web.json --composite false` (plus `-p tsconfig.node.json` when main changes), `npx vitest run`, `impeccable detect --json <files>`, then a visual check.

## Grok Bot layout additions

- Avatar picker: colour and shape are chosen when creating a session and saved per session (`sessions.avatar`). Avatars idle-animate: eyes look left, right, down, blink, then the body turns a full 3D turn (rotateY) 2-3 times.
- Turn result card (`TurnResult` in `EventRow.tsx`): shown after the latest finished turn that has changes. Title, Done chip, branch, files changed with +/−, "Create PR" and "View changes".
- Approval card: question style. Title "Allow {summary}?", lettered rows A Approve (Y), B Always allow, C Deny (N), arrow keys move the choice, "Done" submits.
- Chat: grey agent bubbles, black user bubbles, steps as one centred system line, round scroll-to-latest button, 8px composer.
- Dialogs: 360px centred sheet, two 6px buttons. Menus: 8px, 36px items.
