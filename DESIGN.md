---
name: AgentDeck
description: Quiet, native-feeling desktop deck for supervising coding-agent sessions.
colors:
  chrome: "oklch(0.965 0.004 85)"
  background: "oklch(0.99 0.003 85)"
  panel: "oklch(0.955 0.004 85)"
  overlay: "oklch(1 0 0)"
  foreground: "oklch(0.18 0.004 85)"
  muted: "oklch(0.935 0.005 85)"
  muted-foreground: "oklch(0.48 0 0)"
  faint: "oklch(0.52 0 0)"
  primary: "oklch(0.15 0 0)"
  primary-foreground: "oklch(0.985 0 0)"
  link: "oklch(0.5 0.17 260)"
  ok: "oklch(0.5 0.12 150)"
  warn: "oklch(0.55 0.14 70)"
  destructive: "oklch(0.55 0.19 25)"
  avatar-ink: "#ffffff"
  project-0: "oklch(0.58 0.13 30)"
  project-1: "oklch(0.58 0.13 70)"
  project-2: "oklch(0.58 0.13 110)"
  project-3: "oklch(0.58 0.13 155)"
  project-4: "oklch(0.58 0.13 195)"
  project-5: "oklch(0.58 0.13 235)"
  project-6: "oklch(0.58 0.13 275)"
  project-7: "oklch(0.58 0.13 330)"
typography:
  meta: { fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', system-ui, sans-serif", fontSize: "11px", lineHeight: 1.4 }
  small: { fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', system-ui, sans-serif", fontSize: "12px", lineHeight: 1.5 }
  body: { fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', system-ui, sans-serif", fontSize: "13px", lineHeight: 1.5 }
  prose: { fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', system-ui, sans-serif", fontSize: "14px", lineHeight: 1.6 }
  title: { fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', system-ui, sans-serif", fontSize: "16px", fontWeight: 600, lineHeight: 1.4 }
  mono: { fontFamily: "'Geist Mono Variable', ui-monospace, 'SF Mono', Menlo, monospace", fontSize: "12px", lineHeight: 1.5 }
rounded:
  sm: "4px"
  md: "6px"
  lg: "8px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
components:
  button-default: { backgroundColor: "{colors.primary}", textColor: "{colors.primary-foreground}", rounded: "{rounded.md}", height: "28px", padding: "0 12px" }
  button-secondary: { backgroundColor: "{colors.muted}", textColor: "{colors.foreground}", rounded: "{rounded.md}", height: "28px", padding: "0 12px" }
  button-destructive-solid: { backgroundColor: "{colors.destructive}", textColor: "#ffffff", rounded: "{rounded.md}", height: "28px", padding: "0 12px" }
  input: { backgroundColor: "transparent", textColor: "{colors.foreground}", rounded: "{rounded.md}", height: "28px", padding: "0 10px" }
  badge: { backgroundColor: "{colors.muted}", textColor: "{colors.muted-foreground}", rounded: "{rounded.md}", padding: "2px 8px" }
  dialog: { backgroundColor: "{colors.overlay}", rounded: "{rounded.lg}", padding: "24px" }
  user-bubble: { backgroundColor: "{colors.muted}", textColor: "{colors.foreground}", rounded: "{rounded.lg}", padding: "10px 16px" }
  page-header: { height: "48px", padding: "0 16px" }
---

# Design System: AgentDeck

## Overview

**Creative North Star: "The Quiet Instrument"**

A dense, native-feeling control surface in pure neutral greys that follows the OS light/dark scheme. Colour is rationed: it appears only for status (needs-you amber, ok, error, diff add/del) and for per-project identity hues. The primary action is the inverted foreground, not a brand colour.

Depth is tonal and borders are hairlines. Type is the macOS system face at a small, fixed ramp, with Geist Mono for code and terminals.

**Key Characteristics:**
- Pure neutral surface ladder, no chromatic accent.
- Status is carried by shape plus colour, never colour alone.
- 4/6/8px radii, 1px borders, a single overlay shadow.
- One 120ms ease-out rhythm for state changes.

## Colors

Neutral greys in OKLCH (chroma 0), with semantic status colours and eight project hues. In dark, chrome (sidebar, side panel) sits one step above the work surface. Dark values are redefined under `prefers-color-scheme: dark`; the names and roles below are the same in both.

### Primary
- **Inverted Ink** (`primary` / `primary-foreground`): the default button fill and text selection. Near-black on light, near-white on dark.

### Secondary
- **Link Blue** (`link`): inline links only.

### Tertiary (status)
- **Needs-you Amber** (`warn`): waiting-on-human dot, warn badge, Banner.
- **Go Green** (`ok`): ok badge and diff additions (`--add` tint).
- **Stop Red** (`destructive`): errors, destructive buttons, diff deletions (`--del` tint).
- **Project hues** (`project-0` to `project-7`, 45-degree steps, L 0.58 light / 0.72 dark): project avatars and identity only. `avatar-ink` (white light, `oklch(0.2 0 0)` dark) is the text/eye colour on those fills.

### Neutral
- **Chrome** (`chrome`): window and sidebar.
- **Work Surface** (`background`): main content.
- **Panel** (`panel`): raised regions.
- **Overlay** (`overlay`): menus, dialogs, tooltips.
- **Muted** / **Muted Foreground** / **Faint**: fills, secondary text, tertiary text and icons.
- **Border** (8% black / 7% white) and **Input** (16% / 13%): hairlines and control strokes. **Scrim** dims behind dialogs.

### Named Rules
**The Status-Only Colour Rule.** Chromatic colour means status or project identity. Chrome and actions stay neutral.
**The Surface Ladder Rule.** chrome < background < panel < overlay. Pick the step; do not invent a grey.

## Typography

**Display Font:** none.
**Body Font:** SF Pro via `-apple-system, BlinkMacSystemFont, 'SF Pro Text', system-ui, sans-serif`
**Label/Mono Font:** Geist Mono Variable (fallback `ui-monospace, 'SF Mono', Menlo`)

**Character:** The platform voice for UI, a single mono for code.

### Hierarchy
- **Title** (600, 16px, 1.4): page and dialog titles.
- **Prose** (400, 14px, 1.6): chat message text.
- **Body** (400, 13px, 1.5): default UI text and buttons (500 weight).
- **Small** (12px, 1.5): secondary rows, small buttons, tooltips, banners.
- **Meta** (11px, 1.4): badges and timestamps.

### Named Rules
**The Small Ramp Rule.** Use the five named sizes; no ad-hoc pixel sizes. Use `tnum` for numbers that align.

## Layout

Sidebar plus main pane plus optional right side panel. The sidebar is resizable 240 to 400px (default 300px); the side panel has its own Resizer (default 480px). Resizers are 1px lines with a wider hit area, keyboard-nudgeable and double-click to reset. Full-page views open with PageHeader (48px, bottom border, draggable title bar). Spacing follows a 4px grid; controls are 24/28/32px tall.

## Elevation & Depth

Tonal layering plus hairline borders. The only shadow is `shadow-overlay` on floating layers (menus, tooltips, dialogs).

### Shadow Vocabulary
- **Overlay** (`box-shadow: 0 8px 24px rgba(0,0,0,0.12)`, dark `0.4`): menus, tooltips, dialogs.

### Named Rules
**The Border-Not-Shadow Rule.** Resting surfaces separate with a 1px border or a surface step, never a shadow.

## Shapes

Small, quiet radii: 6px for buttons, inputs, badges, tabs, tooltips; 8px for dialogs, menus, composer, bubbles. Full circles only for status dots and progress. Avatars are 6px rounded squares.

## Components

### Buttons
- **Shape:** 6px radius, 28px tall (sm 24, lg 32, icon 28 square), 13px/500.
- **Default:** inverted fill; hover at 90%. **Secondary** (the default variant): muted fill. **Outline:** input stroke on overlay. **Ghost:** accent fill on hover only.
- **Destructive:** 12% red tint with red text. **Destructive-solid:** solid red, white text, for the confirm step of an irreversible action.
- **Loading:** spinner Logo, disabled, `aria-busy`.

### Inputs / Fields
Transparent fill, input stroke, 6px radius, 28px tall; visible labels. Focus uses the global ring.

### Badges and StatusDot
Badge: 11px tinted pill-rect (6px) in neutral, primary, ok, warn, danger. StatusDot is the single status glyph: amber dot with halo for needs-you, spinner for working, check for done, X for error, dash for idle. It is shape-coded with an aria-label and is reused in badges, the avatar and the palette.

### Switch
Pill toggle (36x20, full radius, the one circle exception besides dots) for on/off settings: muted track and grey knob off; primary track and primary-foreground knob on. Announced as `role=switch`. Settings pages use an 820px column.

### Dialogs
DialogShell is the one modal frame: scrim, overlay panel, 8px radius, border plus overlay shadow, 150ms fade and zoom. ConfirmDialog sits on it (22.5rem wide, Cancel + confirm, destructive-solid when destructive).

### Tooltips
One TooltipProvider at the app root (300ms delay). Tip shows an overlay-coloured chip with optional Kbd, closes on click and stays shut after window blur until the next input.

### Messages
Agent messages are unbubbled prose on the work surface. User messages are a right-aligned muted bubble (8px radius, max 75% wide).

### Resizer
`role="separator"`, focusable, shows the ring colour on hover and focus.

### PageHeader
Title (16px/600), optional project avatar and name, right-aligned actions.

### Banner
Inline warn notice with a bottom border; persists until the cause is fixed.

## Do's and Don'ts

### Do:
- **Do** use the global `:focus-visible` outline (2px, 1px offset, `ring`) as the only focus style.
- **Do** pair status colour with a shape or label.
- **Do** keep transitions to colour/background/border/opacity at 120ms ease-out; honour `prefers-reduced-motion`.
- **Do** use the Project hue tokens only through avatars, with `avatar-ink` as the foreground.
- **Do** build modals on DialogShell and full pages on PageHeader.

### Don't:
- **Don't** add per-component focus rings or glow.
- **Don't** use shadows on resting surfaces, blur or glass, or radii above 8px.
- **Don't** add a chromatic brand accent; the primary is the inverted foreground.
- **Don't** use `destructive-solid` for anything but the final irreversible confirm.

### Layout rules
- **Sidebar row anatomy.** Line 1: StatusDot, title (bold when unread), age. Line 2 (faint): branch, diff Stat, preview. No avatar on expanded rows; selected = muted fill plus a 2px left bar.
- **Only approvals get a bordered card.** Tool steps, turn results and diffs are flat rows on the work surface.
- The Changes panel is open by default.
- **Dark theme** is warm (hue 60, chroma ~0.005); `chrome` equals `background`, separated by hairlines only.
- Side-panel tabs are underline style with a Changes file count; the composer holds model/mode chips and send in its bottom row.
