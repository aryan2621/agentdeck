# TRACKER: AgentDeck vs Conductor (reference)

Goal: AgentDeck should match the reference app as closely as possible, and UI similarity matters most (user's words). Reference = **Conductor**, a macOS app that runs Claude Code and Codex in git-worktree "workspaces". It is seen in 27 desktop screenshots (`~/Desktop/Screenshot 2026-11-26 at *.png`). Two of the 29 are not the reference: `10.46.18 PM` is the user's VS Code with an "Electron quit unexpectedly" dialog, and `10.22.00` and `10.22.09 PM` are light-theme sidebar crops. Those two crops are Conductor, and they show the `agentdeck` repo with a workspace named "Product explain".

Sources: screenshot notes were taken by reading the images (not re-verified by eye). The AgentDeck inventory comes from code reading, and **the app was not run**. Items marked `?` are uncertain. Update the Status column as work lands: `[ ]` todo, `[~]` partial, `[x]` done.

Naming map: Conductor "workspace" = AgentDeck "session". Conductor "repository" = AgentDeck "project".

---
## A. Already matching (no work, or only verify)
- Sidebar chrome: toggle + back/forward, "<Name>'s Mac" account row, search, Home, Create, "My workspaces" label, per-repo "+" button, selected-row highlight. Footer has usage and settings.
- Home/empty state: 3 tiles Open project / Open GitHub project / Quick start, with the pixel wordmark.
- Create project modal: name, parent folder + Browse, and a checklist (Create folder, Initialize Git, Create GitHub repo, Add project). Conductor also lists "Create workspace" as the last step.
- Settings shell: "Back", search (⌘F), groups Personal / Agents & environment / Repositories / More. Repo sub-pages General / Git / Environment? / Scripts / Actions.
- Settings pages present: General, Account, Usage, Appearance, Keyboard shortcuts, Default models (5-slot loadout, drag), Git, Agents, Advanced.
- Workspace view: 3-column layout, chat tab, side panel with All files / Changes / Checks, bottom drawer with Run / Terminal, Create PR button, Review button, per-file "Viewed", "All changes" diff tab, revert per file, tool-call grouping, thinking/elapsed indicator, stop button, queue.
- Repo General: root path, workspaces path, Remove repository. Repo Git: base branch + remote + delete-branch-on-archive.
- Approvals, fork/rename/archive/export/rewind, multi-account and limits (AgentDeck goes beyond Conductor here).
- Color themes and Thanksgiving theme exist (not in the screenshots, extra).

---
## B. Gaps: missing or different (prioritized)

### P1 UI-visible and core to the workspace view
| ID | Gap | Reference behavior | AgentDeck today | Status |
|----|-----|--------------------|-----------------|--------|
| G1 | Effort/reasoning selector | Composer chip "GPT-5.6 Sol  High v" (model + effort) | model chip only; no effort anywhere | [x] |
| G2 | New-workspace intro | System card "You're in a new copy of <repo> called <name>" + event log (Branched <br> from origin/master; Created <dir> and copied N files; "Optional: add a setup script") | empty-session intro + 3 starter chips only | [x] setupWorktree returns copied count (setupOutput IPC); UI can show it |
| G3 | Suggestion chips | 4 dashed chips: Review recent PRs / Improve agent instructions / Fix a TODO / Read the docs | 3 chips: Understand this repo / Fix a failing test / Review my changes (`lib/starters.ts`) | [x] |
| G4 | Bottom drawer tabs | Setup, Run, Terminal, "+" ; Run empty state "Run tests or a development server..." + "Add action" | Run + Terminal only; no Setup tab | [x] |
| G5 | Right-pane "Artifacts" tab | Artifacts / All files / Changes N / Checks | no Artifacts tab | [x] minimal: lists .context files |
| G6 | Fix errors / Resolve conflicts buttons | Buttons beside Review / Create PR with custom instructions per repo | not present | [~] buttons + prompts + conflict detection done; fix/resolve keyed off gh PR checks/mergeable |
| G7 | Auto workspace title | Workspace renamed from first prompt (e.g. "Dummy files create"); default names = cities ("Rome", "Khartoum") | title = truncated first message; names not city-based | [x] |
| G8 | Gamified counter | "1/385 cities visited" on Home | none | [x] |
| G9 | Repo context menu | Create workspace / Create from... / Configuration / Hide repository / Remove repository | Create session / Configuration / Remove | [x] |
| G10 | Completion toast | "Project created." + "Open in GitHub" | toasts exist; check this exact one | [x] toast + "Open in GitHub" (projectRemoteUrl IPC) |
| G11 | Sidebar footer | FREE plan badge, Help (?), Usage, Settings | provider tag, Usage, Settings; no help | [x] help menu + compact Limits in footer |
| G12 | Home row/sidebar polish | selected row, unread dot on tab, animated icon while working | unread bold; message previews built but not rendered | [x] previews + unread dot rendered; avatar animates when working |
| G13 | Sidebar filter | n/a in Conductor, but README promises Needs you / Running filter | not implemented (fix README or build) | [x] README claim removed |
| G14 | Composer hint | collapsed composer shows "⌘L to focus" hint | ⌘L works, no hint? | [x] |
| G15 | Diff view modes | 3 toggles (unified / split / preview) + kebab | unified/split only? | [x] unified/split/preview + kebab (open in editor, mark all viewed) |
| G16 | Light theme fidelity | settings screens shown in light theme: off-white bg, charcoal toggles, grey off-toggles | needs side-by-side check | [x] verified light+dark screenshots, off-white bg and charcoal toggles match |

### P2 Settings > General (Conductor has 11 rows; AgentDeck has 3 sections)
| ID | Setting | Status |
|----|---------|--------|
| S1 | Send messages with (Enter / ⌘Enter; hint ⇧↵ newline) | [x] |
| S2 | Follow-up behavior (Steer / Queue; hint ⌘↵ to queue). AgentDeck only has /steer and auto-queue | [x] default Queue (Conductor shows Steer); ⌘↵ flips |
| S3 | Agent notifications toggle (exists as 3 switches, not one) | [x] master + 3 kinds as sub-section |
| S4 | Completion sound picker + Test + "Add sound..." (groups Classic / Novelty / SF Muni) | [x] macOS system sounds via afplay (Classic/Novelty split is ours) + Add sound |
| S5 | Full disk access status + Open System Settings | [x] probes TCC.db |
| S6 | Arrange workspaces manually | [x] sessionOrder + move up/down in Sidebar |
| S7 | Auto-convert long text (>5000 chars) into text attachment | [x] chip, sent as fenced block |
| S8 | "I'm not absolutely right, thank you very much" (strip "You're absolutely right!") | [x] strips leading phrase at render |
| S9 | Caffeinate while agents run (off below 10% battery) | [x] pmset battery check every 60s |
| S10 | Allow agents to edit workspaces | [-] removed (no consumer) |
| S11 | Restart automatically on update (description cut off in screenshot) | [x] autoUpdater quitAndInstall |
AgentDeck-only (keep): default permission mode, parallel cap.

### P2 Settings > Account
| ID | Item | Status |
|----|------|--------|
| A1 | Profile block (avatar, name, email) | [x] |
| A2 | GitHub connect/Manage row | [x] |
| A3 | Linear connect row (Refresh / Connect) | [ ] |
| A4 | Billing row (no plan concept in AgentDeck; probably skip) | skip? |
| A5 | Enterprise data privacy toggle (disables AI titles + custom MCP) | [-] removed (no consumer) |
| A6 | Send usage data/crash reports toggle | [-] removed (no consumer) |
| A7 | Claude Code tool approvals toggle; Codex tool approvals select (Default) | [x] |
| A8 | Export data / Sign out | skip? |

### P2 Settings > Appearance (Conductor extras)
| ID | Item | Status |
|----|------|--------|
| P1a | Mono font select (Geist Mono) + preview | [x] |
| P1b | Code ligatures toggle | [x] |
| P1c | Markdown style select + preview | [x] |
| P1d | Terminal font + font size slider (12px) + terminal preview | [x] |
(AgentDeck already has theme, code theme with sample, zoom, accessible colors.)

### P2 Settings > Git (global)
Present: branch prefix, delete branch on archive. Missing: GitHub username prefix option (radio GitHub username / Custom / None), Automatically rename new branches, Rename workspace when branch is named, Archive on merge, Automerge, Treat optional checks as blocking, Set upstream on plain git push, Use GitHub stacked PRs (`gh stack`). Also a provider dropdown "GitHub" at top (`?`). IDs: GIT1..GIT8: [x] GIT1 prefix radio + B2 archive fix; [x] GIT2-GIT8 wired: autoRename (first prompt renames branch), renameSessionOnBranch (syncBranch in prStatus), archiveOnMerge, automerge + Merge/Automerge buttons in Checks, optionalChecksBlocking hides Merge on failed check (gh cannot tell optional checks apart).
Bug: "Delete branch on archive" is inert because the UI never removes the worktree (see B2 bugs).

### P2 Settings > Agents / Advanced / Experimental / missing pages
| ID | Item | Status |
|----|------|--------|
| AG1 | Agent tabs for Cursor and OpenCode (AgentDeck has only Claude Code + Codex) | [-] removed (Cursor/OpenCode not wanted) |
| AG2 | Auth tiles: CLI vs **API key** (+ key input, Save, "Get key") with red/green status dot | [x] |
| AG3 | "Use Claude Code with Chrome" toggle | [x] |
| AG4 | "Claude settings ~/.claude/settings.json" row with "Open in" split button | [x] |
| AD1 | Advanced: Codex exe path, SSH key path, Remote execution MCP, Always allow local commands, cloud file sync (OpenCode part removed: not wanted; rest out of scope) | [-] removed |
| AD2 | Conductor root dir copy: warns that changing removes repos from the app | [x] warning states existing sessions stay where they are (repos are not removed) |
| EX1 | **Experimental page** missing: Auto permission mode, Big terminal mode (⌘⇧T), New workspace page, Ship it, Artifacts page, Menu bar, Split tabs, Add projects without GitHub, Dashboard, Voice mode (Ctrl+Shift+D) | [x] Big terminal and Menu bar implemented. Auto permission mode (Claude 'auto', gated by toggle). Skipped: New workspace page, Ship it, Split tabs, Dashboard, Voice mode |
| AR1 | **Artifacts page** (Personal) missing | [x] lists .context files across sessions, open and reveal |
| EN1 | **Environment pages** (global, and per repo) missing | [x] global + per repo, both passed to Claude/Codex agents, terminals and scripts |

### P2 Per-repo settings
| ID | Item | Status |
|----|------|--------|
| R1 | General: Preview URLs (name + URL w/ `$CONDUCTOR_PORT`, add/remove) and "Open previews on plain localhost" | [x] session menu > Open preview (port substituted, plain localhost honoured) |
| R2 | General: Files to copy textarea (".env*") + "No matching gitignored files found" + refresh (AgentDeck has this under Scripts) | [x] mirrored on General + Scripts (shared) |
| R3 | General: Enterprise data privacy toggle | [-] removed (no consumer) |
| R4 | Git: "Branch new workspaces from" origin/master select, Remote origin select | [x] match |
| R5 | Git: archive-on-merge + upstream toggles | [x] archive-on-merge wired in prStatus (global or per-repo) |
| R6 | Actions: Run mode (Concurrent / Nonconcurrent) | [x] |
| R7 | Actions: Use spotlight testing | [ ] |
| R8 | Actions: 6 collapsible custom-instruction rows (Code review, Create PR, Fix errors, Resolve conflicts, Branch rename, General) | [x] all 6 used; session menu has Ask agent to create PR / rename branch |
| R9 | Env var per workspace `$AGENTDECK_PORT` | [x] |
| R10 | Create project modal: nested confirm "Create a private GitHub repo?" with Owner select + live "Repository name is available." check | [x] owner select, availability check, Create workspace step |

---
## C. Known bugs and code-level gaps found in AgentDeck (not Conductor-specific)
- B1 No effort selector (G1).
- B2 Archive never removes worktree; `deleteBranchOnArchive` has no effect from UI (`sessions` archive passes removeWorktree=false). FIXED: main archiveSession now removes worktree + branch when deleteBranchOnArchive.
- B3 `revertHunk` implemented in main/IPC, no UI. DONE: revert-hunk button in FileTab (uncommitted, unified).
- B4 Shortcuts display-only (no rebinding), no global hotkey.
- B5 Only 4 slash commands; only image attachments (Conductor converts long text to attachments).
- B6 Queue is in-memory only. PR body is always empty. Checks not auto-refreshed.
- B7 Loadout slots 2-5 unused (no quick-switcher consumes them).
- B8 `Limits` compact variant and sidebar previews unused.
- B9 `test.md` is stale (avatar picker, welcome suggestions). README claims a sidebar filter that does not exist. DONE: test.md sections 1-3 and README refreshed.
- B10 Last known e2e: `e2e/smoke.e2e.ts` failed ("app launches and the renderer can reach main over IPC") and Electron crashed on launch (seen in VS Code screenshot). **Check first, nothing else can be visually verified until the app launches.**

---
## D. Open decisions for user
1. Scope: add Cursor/OpenCode agents, cloud workspaces, Linear, Billing, Voice mode, Menu bar, Split tabs? (Recommend: skip cloud/Billing/Linear; do Experimental page with only flags that map to real features.)
2. City-name workspaces + "cities visited" counter: copy exactly?
3. Branding: keep AgentDeck wordmark, or mimic pixel wordmark style only?
4. Env var name: `$AGENTDECK_PORT`.

## E. Suggested fix order
1. B10 launch crash, then screenshot AgentDeck for a true visual diff against the `?`/verify items.
2. G1, G2, G3, G4, G6, G7 (workspace view).
3. Settings General (S1-S11), Git (GIT1-8), Appearance, Account.
4. Per-repo (R1-R10), Experimental/Artifacts/Environment pages.
5. Bugs B2, B3, B9.

## F. Reference facts worth keeping (verbatim)
- Settings nav: Personal [General, Account, Usage, Appearance, Keyboard shortcuts, Default models, Artifacts, Git]; Agents & environment [Agents, Environment]; Repositories [<repo> > General, Git, Environment, Scripts, Actions]; More [Experimental, Advanced].
- Completion sounds: None; Classic: Chime, Choo Choo; Novelty: Odysseus's Pluck, Fahhhh, Quack; SF Muni: Inbound train, Gong...
- Models in loadout: Claude Code (Default recommended, Opus 5.5, Sonnet 5.5, Fable 5.2, Haiku 5.5 ...), Codex (GPT-6.1 Terra/Sol, GPT-6 Astra/Sol/Luna, GPT-5.6 Sol/Terra/Luna).
- Visual: dark = near-black warm #141111, 1px borders, ~6-8px radii, no shadows; off-white primary buttons/toggles; orange/salmon active-tab underline; light theme off-white with charcoal toggles; content column max ~1235px, hairline-separated rows (label bold, description gray).
- Raw per-screenshot notes (will vanish with scratchpad): `/private/tmp/claude-502/-Users-rishabh-verma-Desktop-Personal-desktop/24728c84-30d4-451d-a34a-e97ac8ab60dc/scratchpad/ss_batch{1,2,3}.md`, `product_inventory.md`.

---
## G. Round 1 result (agents: chat, drawer/git, settings General, settings Account/Appearance/Git/Agents, per-repo/sidebar)
Verified: `npm run typecheck` clean, `npx vitest run` 85 passed, e2e smoke passes (B10 resolved). NOT verified: anything visually; the app was never compared to the screenshots, `impeccable detect` is not installed.
Fixed during integration: `ui/select.tsx` group label crashed the General page (Radix `SelectLabel` outside a group); `db.test.ts` fixture missing `effort`.
Done since: S6, R5, GIT2-GIT6, G2, G10, G11, G12, G15, R1, R8, AR1, EN1, AR2, EX1 auto mode.
Skipped on purpose: A3, A5, A6, S10, R3, AG1, AD1, R7, Voice, Split tabs, Dashboard.
Visual pass (light+dark, home, session, drawer tabs, all settings pages): no layout mismatches needing code changes; no console/page errors. Known diffs: General hint text is inline, not on its own line as in Conductor.
RISK: archive now really removes worktree + deletes the local branch because `deleteBranchOnArchive` defaults to true (src/shared/types.ts:185). Unpushed/uncommitted work is lost. Decide: default false, or warn in the Archive confirm.
Default branch prefix is now the GitHub username (was "agentdeck"). S2 follow-up default is Queue (Conductor shows Steer).
NEXT: visual diff pass of every screen vs the screenshots, then wire the stored-only settings.

---
## CM. Composer stats strip + model popover
- [x] CM1 StatsStrip.tsx above composer: Context / Usage / Limits (5h, 7d) / Auth. Context is a dash (no context-window or tokens-in-context source); limits dash when provider reports none.
- [x] CM2 ModelPopover.tsx from the model chip: search, loadout models, Add models + Edit (Settings > Default models), Effort submenu, ⌘⇧/ cycle effort (lib/stats.ts, tested). Drag handles skipped. Loadout rows of other providers not shown (a session cannot change provider).
- [ ] CM3 Fast toggle + ⌘⇧E: hidden, no provider adapter exposes a fast tier (StartOptions has none).

## G. Visual pass 2 (light + dark, 1440x900, compared against Conductor screenshots)
Compared: composer + StatsStrip, model popover (search typing and focus verified), repo menu, per-repo Settings (General, Git, Environment, Scripts, Actions), drawer tabs Setup/Run/Terminal, right panel Artifacts/All files/Changes/Checks, sidebar expanded/collapsed with manual-order arrows.
Fixed: model popover search focus was flaky (now focused on open); Scripts page duplicated its own title; General "Use ⇧↵ for new lines" now on its own line.
Not matched (open): Conductor tucks the stats strip under the composer and shows a context-window meter and a Fast toggle (no data source / provider support); Scripts uses a line-numbered code editor (we use a plain textarea); the Review button was only seen in the Changes pane, not as its own tab.
Dark theme: set via the app's own theme setting, but in this automation the renderer media query did not follow nativeTheme, so emulateMedia was also used.

## ST. Settings polish (Usage + thin tabs)
- HR rule: `SettingsSection` (ui/field.tsx) no longer draws a bottom border, so dividers sit only between rows; same trailing `border-b` removed from General, Advanced, Environment, Experimental, Artifacts and the Agents info list.
- Usage: summary strip (7d / 30d / all), 30-day cost bars, ranked By provider / By project / Top 10 sessions with share bars, empty state. Aggregation in `lib/usage.ts` (+ `usage.test.ts`). Data is one running total per session, so it is dated by session creation; no per-model data is stored.
- Advanced, Environment, Experimental: wrapped in titled `SettingsSection` with a description.
- Verified: typecheck, vitest (97 pass), impeccable detect clean, smoke e2e. Not screenshotted.

---
## MA. Multi-agent plan (approved; plan file: ~/.claude/plans/you-have-the-idea-magical-walrus.md)
Direction: T3 Code-style workbench for Claude Code + Codex on one repo; Conductor is a UI reference only. Decisions: fork-into-new-session for switching agent, group + side-by-side diffs for compare, CodeMirror OK, Queue stays the follow-up default, GitHub username stays the branch prefix.
- [x] RM1 Cities visited counter removed (UI only; `citiesVisited` setting kept because it keeps new session names fresh).
- [x] A1 Same prompt, many agents: `groupId` on sessions (DB migration 4), "Add agent" chips in NewSessionForm (worktree forced on, created one at a time), sidebar collapses a group under "N agents". Not run live.
- [x] A2 Compare view (components/Compare.tsx, "Compare" button on sidebar group header, "Keep this one" archives the rest; checked live 2026-11-27)  - [x] A3 Switch agent (session menu "Switch to <other agent>", `shareWorktreeOf` in createSession, archive keeps a shared worktree; checked live 2026-11-27)  - [x] A4 Split view (menu "Open beside…", store `split`, shortcuts gated per pane via lib/pane.ts; fixed 50/50, no resizer)  - [ ] A5 By-model stats  - [x] A6 Dashboard (sidebar row; Needs you / Working across projects)
- [ ] Enhance: Composer (persist queue, paste to attachment, slash commands), PR flow (body, check polling, fix/resolve context), Scripts editor (CodeMirror), Shortcuts (rebind + global hotkey)
- Cleanup: B7/B8/CM3 turned out to be used or already gone (loadout is read by ModelPopover, `<Limits compact />` is in the sidebar, Fast is only a comment); not removed.
