export const STARTERS = [
  { title: 'Review recent PRs', hint: 'Summarises recent pull requests and flags risks', prompt: 'Review the most recent pull requests in this repository and list bugs or risky changes, most serious first.' },
  { title: 'Improve agent instructions', hint: 'Tightens CLAUDE.md / AGENTS.md', prompt: 'Read this repository and improve its agent instructions file (CLAUDE.md or AGENTS.md, create one if missing) so an agent knows how to build, test and where things live.' },
  { title: 'Fix a TODO', hint: 'Picks one TODO comment and resolves it', prompt: 'Find a TODO or FIXME comment in this codebase, pick the most valuable one, and fix it.' },
  { title: 'Read the docs', hint: 'Walks through the repo documentation', prompt: 'Read the documentation in this repository (README and docs) and summarise how it works and where to start making changes.' }
]
