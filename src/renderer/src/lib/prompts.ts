import type { InstructionKey, Settings } from '../../../shared/types'

/** The repo's General and per-action custom instructions (Actions page), prepended to an agent prompt. */
export function withInstructions(settings: Settings, projectId: string, key: InstructionKey, base: string): string {
  const i = settings.repoActions[projectId]?.instructions ?? {}
  return [i.general, i[key], base].map((s) => s?.trim()).filter(Boolean).join('\n\n')
}

export const PROMPTS = {
  createPr: 'Commit any uncommitted changes, push this branch, and open a pull request with `gh pr create`. Write a clear title and description from the changes.',
  branchRename: 'Rename this branch (`git branch -m`) to a short, descriptive name that fits the changes made so far, and update its upstream if it was pushed.',
  review: 'Review my uncommitted changes and list bugs or risky code, most serious first.',
  fixErrors: 'The CI checks on this branch are failing. Find out why (use `gh pr checks` and the logs), fix the errors, and verify the fix.',
  resolveConflicts: 'This branch has merge conflicts with its base branch. Merge the base branch in, resolve every conflict carefully, and verify the build and tests still pass.',
} as const
