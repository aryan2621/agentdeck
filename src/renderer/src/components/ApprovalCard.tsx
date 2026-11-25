import { useState } from 'react'
import { Check, CheckCheck, ShieldAlert, ShieldCheck, ShieldX, X } from 'lucide-react'
import { actions } from '../store'
import { Badge } from './ui/badge'
import { Button } from './ui/button'
import { Card } from './ui/card'
import { Disclosure } from './ui/collapsible'
import { Tip } from './ui/tooltip'

interface Props { sessionId: string; id: string; kind: string; summary: string; detail?: unknown; allowed?: boolean }

export default function ApprovalCard({ sessionId, id, kind, summary, detail, allowed }: Props): React.JSX.Element {
  const [decision, setDecision] = useState<'Approved' | 'Denied' | null>(allowed === undefined ? null : allowed ? 'Approved' : 'Denied')
  const respond = (allow: boolean, always = false): void => {
    window.api.respondToApproval(sessionId, id, { allow, always }).then(
      () => setDecision(allow ? 'Approved' : 'Denied'),
      actions.fail
    )
  }
  return (
    // Y/N only fire while focus is inside the card, so typing in the composer is never hijacked.
    <Card
      className="flex flex-col gap-2 border-warn/40 p-3" role="group" aria-label={`Approval request: ${summary}`}
      onKeyDown={(e) => {
        if (decision || e.metaKey || e.ctrlKey) return
        if (e.key === 'y') respond(true)
        else if (e.key === 'n') respond(false)
      }}
    >
      <div className="flex items-center gap-2">
        <ShieldAlert className="size-4 text-warn" />
        <b className="font-medium">Approval needed</b>
        <Badge tone="warn">{kind}</Badge>
      </div>
      <div className="font-mono text-xs break-words">{summary}</div>
      {detail !== undefined && (
        <Disclosure head={<span className="text-xs text-muted-foreground">Details</span>}>
          <pre className="max-h-60 overflow-auto p-2.5 font-mono text-xs whitespace-pre-wrap">{typeof detail === 'string' ? detail : JSON.stringify(detail, null, 2)}</pre>
        </Disclosure>
      )}
      {decision ? (
        <Badge tone={decision === 'Approved' ? 'ok' : 'danger'} className="self-start">
          {decision === 'Approved' ? <ShieldCheck className="size-3" /> : <ShieldX className="size-3" />}{decision}
        </Badge>
      ) : (
        <div className="flex gap-2">
          <Button variant="default" autoFocus onClick={() => respond(true)}><Check />Approve <kbd className="font-mono text-[11px] opacity-70">Y</kbd></Button>
          <Tip label="Stop asking for this kind of action in this session">
            <Button onClick={() => respond(true, true)}><CheckCheck />Always allow</Button>
          </Tip>
          <Button variant="destructive" onClick={() => respond(false)}><X />Deny <kbd className="font-mono text-[11px] opacity-70">N</kbd></Button>
        </div>
      )}
    </Card>
  )
}
