import { useState } from 'react'
import { actions, findSession, useStore } from '../store'
import NewSessionForm from './NewSessionForm'
import { Button } from './ui/button'

/** Nothing selected: the new-session screen, or, with no projects, the add-project prompt. */
export default function Welcome(): React.JSX.Element {
  const state = useStore()
  const [over, setOver] = useState(false)
  const project = findSession(state, state.selectedId)?.projectId ?? state.projects[0]?.id
  if (project) return <NewSessionForm key={project} projectId={project} />
  return (
    <div
      className={`flex flex-1 flex-col items-center justify-center overflow-y-auto p-8 ${over ? 'bg-accent' : ''}`}
      onDragOver={(e) => { e.preventDefault(); setOver(true) }} onDragLeave={() => setOver(false)}
      onDrop={(e) => { e.preventDefault(); setOver(false); const f = e.dataTransfer.files[0]; if (f) void actions.addProject(window.api.pathForFile(f)) }}
    >
      <div className="flex max-w-sm flex-col items-start gap-3">
        <h1 className="text-title">Add your first project</h1>
        <p className="text-body text-muted-foreground">Choose or drop a folder with a git repo. Sessions run inside it.</p>
        <Button variant="default" onClick={() => void actions.addProject()}>Add project</Button>
      </div>
    </div>
  )
}
