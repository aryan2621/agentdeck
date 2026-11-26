import { useCallback, useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight, Download, RefreshCw } from 'lucide-react'
import type { HistoryItem, McpServer } from '../../../main/history'
import { actions } from '../state/store'
import { Loading, SettingsRow, SettingsSection } from './ui/field'
import { Row } from './ui/row'
import Avatar from './Avatar'
import { Button } from './ui/button'

const PAGE = 10

export default function ProjectTools({ projectId }: { projectId: string }): React.JSX.Element {
  const [hist, setHist] = useState<HistoryItem[] | null>(null)
  const [page, setPage] = useState(0)
  const [mcp, setMcp] = useState<McpServer[] | null>(null)
  const [importing, setImporting] = useState<string | null>(null)
  const refresh = useCallback(() => {
    setHist(null); setMcp(null); setPage(0)
    window.api.listHistory(projectId).then(setHist, (e) => { setHist([]); actions.fail(e) })
    window.api.listMcp(projectId).then(setMcp, (e) => { setMcp([]); actions.fail(e) })
  }, [projectId])
  useEffect(refresh, [refresh])
  const open = (h: HistoryItem): void => {
    if (importing) return
    setImporting(h.id)
    window.api.importHistory(projectId, h.provider, h.id).then((s) => { actions.upsertSession(s); actions.select(s.id) }, actions.fail).finally(() => setImporting(null))
  }
  return (
    <div className="flex w-full flex-col gap-8">
      <SettingsSection title="Past sessions" description="Sessions found in ~/.claude and ~/.codex for this folder. Select one to import it." action={<Button variant="ghost" size="icon" aria-label="Refresh" onClick={refresh} disabled={hist === null || mcp === null}><RefreshCw /></Button>}>
        {hist === null && <Loading>Looking for past sessions…</Loading>}
        {hist?.length === 0 && <SettingsRow label="None found" />}
        <div className="flex flex-col gap-0.5">
          {(hist ?? []).slice(page * PAGE, (page + 1) * PAGE).map((h) => (
            <Row key={`${h.provider}-${h.id}`} onClick={() => open(h)} className="group items-center gap-3 rounded-lg py-2 text-foreground" title={h.title}>
              <Avatar seed={h.id} size={32} />
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-body font-medium">{h.title}</span>
                <span className="text-small text-muted-foreground">{h.provider} · {new Date(h.mtime).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}</span>
              </div>
              <span className="flex shrink-0 items-center gap-1 text-small text-faint group-hover:text-foreground group-focus-visible:text-foreground"><Download className="size-3.5" aria-hidden />{importing === h.id ? 'Importing…' : 'Import'}</span>
            </Row>
          ))}
        </div>
        {hist && hist.length > PAGE && (
          <div className="flex items-center justify-between py-3 text-small text-muted-foreground">
            <span className="tnum">{page * PAGE + 1}–{Math.min(hist.length, (page + 1) * PAGE)} of {hist.length}</span>
            <div className="flex gap-1">
              <Button variant="outline" size="icon" aria-label="Previous page" disabled={page === 0} onClick={() => setPage(page - 1)}><ChevronLeft /></Button>
              <Button variant="outline" size="icon" aria-label="Next page" disabled={(page + 1) * PAGE >= hist.length} onClick={() => setPage(page + 1)}><ChevronRight /></Button>
            </div>
          </div>
        )}
      </SettingsSection>
      <SettingsSection title="MCP servers" description="Read-only.">
        {mcp === null && <Loading>Reading MCP config…</Loading>}
        {mcp?.length === 0 && <SettingsRow label="None configured" />}
        {(mcp ?? []).map((m, i) => (
          <SettingsRow key={i} label={m.name} description={<span className="break-all font-mono text-small">{m.command}</span>}>
            <span className="font-mono text-small text-muted-foreground">{m.provider} · {m.scope}</span>
          </SettingsRow>
        ))}
      </SettingsSection>
    </div>
  )
}
