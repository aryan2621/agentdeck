# Contributing

1. `pnpm install`, then `pnpm dev`.
2. Run `pnpm typecheck` and `npx vitest run src` before opening a PR.
3. Providers live in `src/main/providers/` and emit only the normalized events in `src/shared/types.ts`. A new agent means a new adapter implementing `ProviderAdapter`.
4. UI follows a dense, native look with one accent colour; no shadows or decorative gradients.
