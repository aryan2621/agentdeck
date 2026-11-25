import { useEffect, useState } from 'react'
import { Download, History, Plug } from 'lucide-react'
import type { HistoryItem, McpServer } from '../../../main/history'
import { actions } from '../store'
import { Badge } from './ui/badge'
import { Card } from './ui/card'

const H = ({ icon: Icon, children }: { icon: React.ElementType; children: React.ReactNode }): React.JSX.Element => (
  <h2 className="flex items-center gap-2 text-sm font-semibold"><Icon className="size-4 text-primary" />{children}</h2>
)
const None = ({ children }: { children: React.ReactNode }): React.JSX.Element => <p className="text-muted-foreground">{children}</p>

export default function ProjectTools({ projectId }: { projectId: string }): React.JSX.Element {
  const [hist, setHist] = useState<HistoryItem[]>([])
  const [mcp, setMcp] = useState<McpServer[]>([])
  useEffect(() => {
    window.api.listHistory(projectId).then(setHist, actions.fail)
    window.api.listMcp(projectId).then(setMcp, actions.fail)
  }, [projectId])
  const open = (h: HistoryItem): void => {
    window.api.importHistory(projectId, h.provider, h.id).then((s) => { actions.upsertSession(s); actions.select(s.id) }, actions.fail)
  }
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-3 overflow-y-auto p-6">
      <H icon={History}>Past sessions in this folder</H>
      {hist.length === 0 && <None>None found in ~/.claude or ~/.codex.</None>}
      {hist.map((h) => (
        <button key={`${h.provider}-${h.id}`} onClick={() => open(h)} className="text-left">
          <Card className="flex items-center gap-3 p-3 transition-colors hover:border-primary/60 hover:bg-accent/40">
            <div className="min-w-0 flex-1">
              <div className="truncate font-medium">{h.title}</div>
              <div className="text-xs text-muted-foreground">{new Date(h.mtime).toLocaleString()}</div>
            </div>
            <Badge>{h.provider}</Badge>
            <Download className="size-3.5 text-muted-foreground" aria-label="Import" />
          </Card>
        </button>
      ))}
      <div className="mt-4"><H icon={Plug}>MCP servers (read-only)</H></div>
      {mcp.length === 0 && <None>None configured.</None>}
      {mcp.map((m, i) => (
        <Card key={i} className="flex items-center gap-2 p-3">
          <b className="font-medium">{m.name}</b>
          <Badge>{m.provider} {m.scope}</Badge>
          <span className="min-w-0 truncate font-mono text-xs text-muted-foreground">{m.command}</span>
        </Card>
      ))}
    </div>
  )
}
