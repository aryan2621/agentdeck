import { useState } from 'react'
import { ShieldCheck, ShieldQuestion, ShieldX } from 'lucide-react'
import { actions } from '../../state/store'
import { Kbd } from '../../components/ui/kbd'
import { Button } from '../../components/ui/button'

interface Props { sessionId: string; id: string; kind: string; summary: string; detail?: unknown; allowed?: boolean }

export default function ApprovalCard({ sessionId, id, kind, summary, detail, allowed }: Props): React.JSX.Element {
  const [decision, setDecision] = useState<'Approved' | 'Denied' | null>(allowed === undefined ? null : allowed ? 'Approved' : 'Denied')
  const respond = (allow: boolean, always = false): void => {
    window.api.respondToApproval(sessionId, id, { allow, always }).then(
      () => setDecision(allow ? 'Approved' : 'Denied'),
      actions.fail
    )
  }
  const text = detail === undefined ? '' : typeof detail === 'string' ? detail : JSON.stringify(detail, null, 2)
  if (decision) return (
    <div className="flex items-center gap-2 py-0.5 pl-4 text-small text-muted-foreground" role="status">
      {decision === 'Approved' ? <ShieldCheck className="size-3.5 text-ok" /> : <ShieldX className="size-3.5 text-destructive" />}
      <span>{decision}</span><span className="min-w-0 truncate font-mono">{summary}</span>
    </div>
  )
  return (
    // Keys only fire while focus is inside the card, so typing in the composer is never hijacked.
    <div
      className="flex max-w-[640px] flex-col gap-3 rounded-lg border border-warn/60 bg-overlay p-4 outline-none focus-visible:ring-1 focus-visible:ring-warn" role="group" aria-label={`Approval request: ${summary}`} tabIndex={-1}
      ref={(el) => { if (el && !/^(INPUT|TEXTAREA)$/.test(document.activeElement?.tagName ?? '')) el.focus() }}
      onKeyDown={(e) => {
        if (e.metaKey || e.ctrlKey) return
        if (e.key === 'y') respond(true)
        else if (e.key === 'n') respond(false)
        else if (e.key === 'Escape') e.currentTarget.blur()
        else if (e.key === 'A') respond(true, true)
        else if (e.key === 'Enter' && e.target === e.currentTarget) respond(true)
      }}
    >
      <div className="flex items-center gap-2 text-small font-medium text-foreground"><ShieldQuestion className="size-3.5 text-warn" />Needs your OK<span className="ml-auto font-mono font-normal text-muted-foreground">{kind}</span></div>
      <code className="font-mono text-body break-words">{summary}</code>
      {text && <pre className="max-h-48 overflow-auto border-l-2 border-border pl-3 font-mono text-small whitespace-pre-wrap">{text}</pre>}
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="default" onClick={() => respond(true)}>Approve<Kbd>Y</Kbd></Button>
        <Button variant="ghost" onClick={() => respond(true, true)} title={`Stop asking for ${kind} in this session`}>Always allow {kind}<Kbd>⇧A</Kbd></Button>
        <Button variant="ghost" className="ml-auto text-destructive" onClick={() => respond(false)}>Deny<Kbd>N</Kbd></Button>
      </div>
    </div>
  )
}
