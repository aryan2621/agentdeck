import {
  Bot,
  Cpu,
  FileCode,
  HardDrive,
  GitBranch,
  History,
  Keyboard,
  MousePointerClick,
  Palette,
  SlidersHorizontal,
  User,
  BarChart3,
  FlaskConical,
  KeyRound,
  Shapes
} from 'lucide-react'

export interface Item {
  id: string
  icon?: React.ElementType
  description: string
  keywords?: string
}
export const PERSONAL: Item[] = [
  {
    id: 'General',
    icon: SlidersHorizontal,
    description: 'How new sessions start and run, and when AgentDeck notifies you.',
    keywords: 'permission parallel notifications alerts notify'
  },
  {
    id: 'Account',
    icon: User,
    description: 'Extra logins per provider and their usage limits.',
    keywords: 'login limits'
  },
  {
    id: 'Usage',
    icon: BarChart3,
    description: 'Tokens and cost across your sessions.',
    keywords: 'cost tokens'
  },
  {
    id: 'Appearance',
    icon: Palette,
    description: 'Light, dark, or follow macOS.',
    keywords: 'theme dark light'
  },
  {
    id: 'Keyboard shortcuts',
    icon: Keyboard,
    description: 'Every shortcut in one place.',
    keywords: 'keys hotkeys'
  },
  {
    id: 'Default models',
    icon: Cpu,
    description: 'The provider and model a new session uses.',
    keywords: 'provider claude codex'
  },
  {
    id: 'Artifacts',
    icon: Shapes,
    description: 'Files your agents produce for you to keep.',
    keywords: 'files output'
  },
  {
    id: 'Git',
    icon: GitBranch,
    description: 'Branch names and cleanup for session worktrees.',
    keywords: 'branch prefix archive delete worktree'
  }
]
export const AGENTS: Item[] = [
  {
    id: 'Agents',
    icon: Bot,
    description: 'Where each agent CLI lives.',
    keywords: 'cli path gh executable'
  },
  {
    id: 'Environment',
    icon: KeyRound,
    description: 'Variables passed to agents, terminals and setup scripts.',
    keywords: 'env variables secrets'
  }
]
export const MORE: Item[] = [
  {
    id: 'Experimental',
    icon: FlaskConical,
    description: 'Experimental features that are under development. Expect breaking changes.',
    keywords: 'terminal menu bar tray flags'
  },
  {
    id: 'Advanced',
    icon: HardDrive,
    description: 'Where session worktrees are stored.',
    keywords: 'directory folder worktrees root path'
  }
]
export const REPO: Item[] = [
  { id: 'General', icon: SlidersHorizontal, description: 'Where this repository lives.' },
  {
    id: 'Git',
    icon: GitBranch,
    description: 'Which branch new worktrees start from and where they push.',
    keywords: 'branch remote origin base archive delete'
  },
  {
    id: 'Environment',
    icon: KeyRound,
    description: 'Variables for this repository, on top of the global ones.',
    keywords: 'env variables secrets'
  },
  {
    id: 'Scripts',
    icon: FileCode,
    description: 'Run when a worktree is created for a new session (agentdeck.json).',
    keywords: 'setup copy worktree'
  },
  {
    id: 'Actions',
    icon: MousePointerClick,
    description: 'Commands you can run from the Run tab (agentdeck.json).',
    keywords: 'run dev server test shortcut'
  },
  {
    id: 'History & MCP',
    icon: History,
    description: 'Import past sessions and inspect MCP servers configured in your CLI.',
    keywords: 'import mcp history'
  }
]

export interface Page {
  tab: string
  title: string
  description: string
  projectId?: string
}
export function pageOf(view: { tab?: string; projectId?: string }): Page {
  const { projectId } = view
  const list = projectId ? REPO : [...PERSONAL, ...AGENTS, ...MORE]
  const item = list.find((i) => i.id === view.tab) ?? list[0]
  return { tab: item.id, title: item.id, description: item.description, projectId }
}
