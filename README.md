# AgentDeck

A macOS app for running several AI coding agents (Claude Code and Codex) in parallel, each in its own git worktree, with one place to see which agent needs you.

## Features
- Projects and sessions: add a local git repo, start chat sessions, resume after restart.
- Worktree per session, plus `agentdeck.json` setup scripts.
- Terminal tab in the session's worktree.
- Approve or deny edits and commands; Supervised, Auto-edit and Full access modes.
- Changes tab: diff, commit, push and `gh pr create`.
- Status badges, dock badge and notifications.
- Multiple Claude/Codex logins, moving a session between accounts, usage and plan limits.

## Requirements
macOS, Node 24, pnpm, and the `claude` and `codex` CLIs installed and logged in. `gh` is needed for pull requests.

## Develop
```sh
pnpm install
pnpm dev          # run the app
pnpm typecheck
npx vitest run src
pnpm build:mac    # unsigned .dmg in dist/
```

## agentdeck.json
Put this in a repo root to prepare each new worktree:
```json
{ "copy": [".env"], "setup": "pnpm install" }
```

## Limitations
- Worktrees isolate files and branches, not ports, databases or Docker names.
- Usage and cost figures are estimates. Plan-limit data depends on what each provider exposes.
- Full-access mode lets agents run any command on your Mac. It is not a sandbox.
- Agents only run while the app is open.
- You install each CLI yourself and log in with your own subscription.
- Unsigned builds trigger a macOS Gatekeeper warning (right-click, Open).

## License
MIT
