import { useState } from 'react'
import { ShieldCheck, ShieldQuestion, ShieldX } from 'lucide-react'
import { actions } from '../store'
import { Kbd } from './ui/kbd'
import { Button } from './ui/button'

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
      className="flex max-w-[640px] flex-col gap-3 rounded-lg border border-warn/50 bg-overlay p-4 outline-none" role="group" aria-label={`Approval request: ${summary}`} tabIndex={-1}
      ref={(el) => { if (el && !/^(INPUT|TEXTAREA)$/.test(document.activeElement?.tagName ?? '')) el.focus() }}
      onKeyDown={(e) => {
        if (e.metaKey || e.ctrlKey) return
        if (e.key === 'y') respond(true)
        else if (e.key === 'n' || e.key === 'Escape') respond(false)
        else if (e.key === 'a') respond(true, true)
        else if (e.key === 'Enter' && e.target === e.currentTarget) respond(true)
      }}
    >
      <div className="flex items-center gap-2 text-small text-muted-foreground"><ShieldQuestion className="size-3.5 text-warn" />Needs your OK<span className="font-mono text-faint">{kind}</span></div>
      <b className="text-body font-medium break-words">{summary}</b>
      {text && <pre className="max-h-48 overflow-auto rounded-md bg-panel px-3 py-2 font-mono text-small whitespace-pre-wrap">{text}</pre>}
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => respond(true)}>Approve<Kbd>Y</Kbd></Button>
        <Button variant="outline" onClick={() => respond(true, true)} title={`Stop asking for ${kind} in this session`}>Always allow<Kbd>A</Kbd></Button>
        <Button variant="outline" onClick={() => respond(false)}>Deny<Kbd>N</Kbd></Button>
      </div>
    </div>
  )
}
