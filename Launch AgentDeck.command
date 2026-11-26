#!/bin/zsh
# Double-click in Finder to launch from your normal macOS Terminal session.
# Restricted automation shells can abort Electron before app code starts.
set -e
cd -- "${0:A:h}"

if ! command -v pnpm >/dev/null 2>&1; then
  print -u2 'pnpm was not found. Open your usual development Terminal and run pnpm start in the agentdeck folder.'
  exit 1
fi

exec pnpm start
