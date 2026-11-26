# AgentDeck manual test plan

Run with `npm run dev`. Press ⌘R after any code change. Each step has **What** (what to do), **How** (exact action) and **Expected** (what you should see). Tick the box when it matches.

Test in light mode first, then repeat sections 1, 4 and 5 in dark mode (System Settings, Appearance).

## 0. Automated checks

- [ ] `npm run typecheck` shows no errors.
- [ ] `npx vitest run` shows all tests passed (2 skipped is normal).
- [ ] `npx knip` reports nothing.

## 1. First run (no projects)

| # | What | How | Expected |
|---|------|-----|----------|
| 1.1 | Empty state | Launch with no projects | The main area shows the Home tiles (Open project, Clone from GitHub, Quick start). |
| 1.2 | Sidebar empty | Look at the sidebar | "No projects yet. Add one with the folder button above." "Create" is disabled. |
| 1.3 | Add project | Click "Add project" and pick a git folder | The project appears in the sidebar. The main area becomes the New session form. |
| 1.4 | Quick start | Home, Quick start, enter a name and parent folder, tick the private GitHub repo box, Create | A second dialog "Create a private GitHub repo?" asks for the Owner and repo name and says "Repository name is available." when free. Confirming shows a checklist ending in "Create workspace", then the first session opens. |

## 2. New session form

| # | What | How | Expected |
|---|------|-----|----------|
| 2.1 | Layout | Open "New session" (⌘N) | A prompt box with compact pickers: project, agent, model, permission mode. Enter creates, Shift+Enter adds a line. |
| 2.2 | Worktree | Toggle the worktree option and submit | The session shows a branch name. A worktree folder exists on disk. |
| 2.3 | Disabled state | Clear the prompt | The submit button cannot be clicked. |
| 2.4 | Submit | Type a prompt, press Enter | A session is created and its view opens. |
| 2.5 | Create from | Project menu, "Create from...", enter a branch or PR number | A session opens whose worktree starts from that branch or PR. |
| 2.6 | Dev port | In the session terminal run `echo $AGENTDECK_PORT` | A port number between 50000 and 59999, stable for that session. |

## 3. Sidebar and rail

| # | What | How | Expected |
|---|------|-----|----------|
| 3.1 | Session row | Look at the new session | Avatar, title, and `+/-` counts once files change (if enabled in Appearance). |
| 3.2 | Search | Type part of a message in Search (⌘F) | A "Search results" list appears. Clicking a hit opens that session. Clearing the field restores the list. |
| 3.3 | Project menu | Hover a project, open its menu | Create session, Create from..., Configuration, Hide repository, Remove repository. |
| 3.4 | Hide | Choose "Hide repository" | The project leaves the sidebar. Settings, General lists it under "Hidden repositories" with a Show button. |
| 3.5 | Unread dot | Start a long task, switch to another session | The first session's title turns bold when the agent replies. Opening it clears that. |
| 3.6 | Project group | Click a project name | The group collapses and expands. |
| 3.7 | Rail | Press ⌘B | The sidebar shrinks to an avatar rail. Hovering an avatar shows the title. Press ⌘B again to restore. |
| 3.8 | Help | Click the help (?) button in the footer | A menu with Keyboard shortcuts, Documentation and Report an issue. |
| 3.9 | Revert hunk | Changes, a modified file, hover a hunk header, click revert | A confirm appears; confirming removes only that hunk. |

## 4. Avatar animation

| # | What | How | Expected |
|---|------|-----|----------|
| 4.1 | Idle | Watch any avatar for about 10 s | Eyes look left, right, down, blink. |
| 4.2 | Spin | Keep watching | A short wind-up, then 2–3 fast 3D turns around the vertical axis while squeezed narrow, then it settles back to its normal shape. |
| 4.3 | Breeze | Watch between spins | The avatar sways gently, pivoting from the bottom. |
| 4.4 | Does not follow mouse | Move the cursor around | The eyes do not follow the cursor. |
| 4.5 | Reduced motion | Turn on "Reduce motion" in macOS | No animation at all. |

## 5. Session view

| # | What | How | Expected |
|---|------|-----|----------|
| 5.1 | Header | Open a session | A centred pill with avatar (the saved one), title and project. Right side: round buttons for mode, status, panel toggle and ⋯. No "Changes" text. |
| 5.2 | Tooltips | Hover each round button | A tooltip shows the label. |
| 5.3 | Send | Type a message, press Enter | A black bubble appears on the right. Status turns to Working. |
| 5.4 | Reply | Wait for the agent | A grey bubble on the left, at most 75% wide. Links are blue with no underline. |
| 5.5 | Steps | After tool use | One centred grey line "Ran N steps · M files changed ›". Clicking expands the steps in place. |
| 5.6 | Scroll button | Scroll up in a long chat | A round ↓ button appears above the composer. Clicking it jumps to the latest. It disappears at the bottom. |
| 5.7 | Result card | When a turn finishes with file changes | One line: green Done, "N files +a −d", branch, then "View changes" and a disabled "Create PR ↗" (tooltip: commit first). Only on the latest turn, not while working. |
| 5.8 | View changes | Click "View changes" | The side panel opens on the Changes tab. |
| 5.9 | Create PR | Hover "Create PR ↗" on the result card | The result-card button is disabled while changes are uncommitted; hover shows why. Create the PR from the Changes panel (8.4). |
| 5.10 | Rename / Archive / Fork | Use the ⋯ menu | Rename dialog changes the title in the sidebar. Archive removes the session. Fork creates a new session. |
| 5.11 | Move account / Rewind | ⋯ menu | Move to account lists the logins. Rewind lists checkpoints, or "No checkpoints yet". |

## 6. Approval card

| # | What | How | Expected |
|---|------|-----|----------|
| 6.1 | Trigger | Use mode "Ask before edits" and ask the agent to edit a file or run a command | The status becomes "Needs you". A card with an amber border appears: "Needs your OK", the summary and the command/diff inline. The card has focus unless you are typing in the composer. |
| 6.2 | Buttons | Look at the card | Three buttons with shortcut hints: Approve Y, Always allow A, Deny N. |
| 6.3 | Keys | Focus the card, press A, Enter or Esc | A = always allow, Enter = approve, Esc = deny. |
| 6.4 | Done | Click a button | The card collapses to one line: "Approved {summary}" or "Denied {summary}". The agent continues or stops. |
| 6.5 | Y / N | Focus the card, press Y or N | Approves or denies immediately. |
| 6.6 | No hijack | Click into the composer, type "y" | Letters go into the composer. The card does not react. |
| 6.7 | Always allow | Pick B, Done | The same kind of action does not ask again in this session. |
| 6.8 | Composer | While waiting, look at the composer | A banner says messages are queued until you decide. |

## 7. Composer

| # | What | How | Expected |
|---|------|-----|----------|
| 7.1 | Shape | Look at the composer | A round pill, about 48px high, with an outlined + on the left. No mic. |
| 7.2 | Grows | Type several lines (Shift+Enter) | The pill becomes a rounded rectangle and grows (up to a max height). |
| 7.3 | Send button | Empty vs text | Disabled when empty. A black round ↑ with text. |
| 7.4 | Queue | Send a message while the agent is working | The button is a list-plus icon. A "Queued" chip appears and the message goes out after the turn. The chip's × removes it. |
| 7.5 | Stop | While working | A red round Stop button appears. Clicking it interrupts the agent. |
| 7.6 | Image | Click +, paste, or drop an image | A thumbnail appears with an × button. The image is sent with the message. Over 5 MB shows an error. |
| 7.7 | @file | Type `@` and part of a filename | Matching files appear as chips. Clicking one inserts it. |
| 7.8 | Slash commands | Type `/stop`, `/clear-queue`, `/rewind`, `/steer text` | Stop interrupts. Clear-queue empties the queue. Rewind opens the confirm dialog. Steer sends into the running turn. |
| 7.9 | Usage | After a turn | Grey token and cost text on the right. |

## 8. Side panel

| # | What | How | Expected |
|---|------|-----|----------|
| 8.1 | Toggle | Click the panel button | The panel hides or shows. The choice is remembered after ⌘R. |
| 8.2 | Resize | Drag the divider, or focus it and press ← → | The width changes between 320 and 960px and is remembered. |
| 8.3 | Diff tab | After the agent edits files | Files are listed with status letter and `+/−`. Expanding shows a highlighted diff. Scope switch: Uncommitted / Branch vs base. |
| 8.4 | Commit / Push / PR | Enter a message and use the actions | Commit and push work. Create PR needs a message and `gh`. Without `gh` a banner says to install it. |
| 8.5 | Terminal tab | Open it and run `ls` | A real shell in the session folder. |

## 9. Dialogs, menus, palette, settings

| # | What | How | Expected |
|---|------|-----|----------|
| 9.1 | Dialog | ⋯ → Archive | A narrow centred sheet. Centred title and text. Two pill buttons: outline Cancel and red Archive. Esc cancels. |
| 9.2 | Menu | Open ⋯ | Rounded menu, 36px items with icons, grey hover. |
| 9.3 | Palette | Press ⌘K | Search opens. There is no "All sessions" item. |
| 9.4 | Settings | Click the gear | Settings opens. Changes persist after ⌘R. (Not restyled in this round.) |
| 9.5 | Grid gone | Look everywhere | No Grid view, row or shortcut. |

## 10. Persistence and errors

| # | What | How | Expected |
|---|------|-----|----------|
| 10.1 | Restart | Quit and relaunch | Projects, sessions, chats and avatars are all back. |
| 10.2 | Error status | Force a failure (bad model or logout) | A red error block in the chat and a red status. |
| 10.3 | Accessibility | Use Tab only | A visible focus ring everywhere. Dialogs trap focus. Approval card is reachable. |

## Known gaps

- No "NEW" divider in the chat.
- Palette recents and session actions, Settings sections, Changes-panel stepper and file grouping, and ProjectTools were not redesigned.

## Added in the UI pass

- Hovering or focusing a chat message shows its time and a Copy button.
- The side panel starts closed and opens by itself the first time files change; a manual toggle is remembered.
- Dropping a folder on the "Add your first project" screen adds it.

## Added in the skipped-items pass

- Under the composer, Model and Mode chips change them for an idle session (both providers); disabled while it works.
- A "New" divider marks messages that arrived since you last viewed the session. Hover a message, "Fork from here" starts a session from that point.
- Cmd+K shows Recent sessions, "This session" actions (toggle panel Cmd+\, rename, rewind, archive) and global actions with their keys.
- Changes panel: files grouped by folder, expand/collapse all, "Open file" per file, and a Commit, Push, Pull request stepper (ahead count, "Commit first", "Push first"). A created PR shows a "View PR" toast button. The stepper stays after a push so Create PR remains reachable. Toasts appear top-centre so they cover neither the stepper nor the panel tabs.
- Settings: Appearance (system/light/dark), Keyboard shortcuts, "Saved" note, default model list, account Remove (refused while a session uses it).
- Terminal uses the full app palette and follows light/dark. Project tools list has Refresh and loading rows.
- Sidebar: usage meter in the account footer, collapse button, Cmd+F focuses Search.
- Revert (Changes panel, Uncommitted scope): expand a file, click Revert, confirm. Modified file returns to HEAD; new file is deleted; refused while the agent is working.
