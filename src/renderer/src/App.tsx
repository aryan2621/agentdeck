import { useEffect } from 'react'
import NewSessionForm from './components/NewSessionForm'
import SessionView from './components/SessionView'
import Terminal from './components/Terminal'
import Grid from './components/Grid'
import ProjectTools from './components/ProjectTools'
import Sidebar from './components/Sidebar'
import SettingsPanel from './components/SettingsPanel'
import { Check, FolderPlus, LogIn } from 'lucide-react'
import Palette from './components/Palette'
import Toasts from './components/Toasts'
import { Button } from './components/ui/button'
import { Empty } from './components/ui/field'
import { actions, findSession, useStore } from './store'

export default function App(): React.JSX.Element {
  const s = useStore()
  useEffect(() => {
    void actions.load()
    const offs = [window.api.onSessionUpdated(actions.upsertSession), window.api.onSelectSession(actions.select)]
    return () => offs.forEach((o) => o())
  }, [])
  const session = findSession(s, s.selectedId)
  const v = s.view
  return (
    <div className="grid h-full grid-cols-[256px_minmax(0,1fr)] bg-chrome">
      <div className="fixed inset-x-0 top-0 z-40 h-2 [-webkit-app-region:drag]" aria-hidden />
      <Sidebar />
      <main className="mt-2 flex min-h-0 min-w-0 flex-col overflow-hidden rounded-tl-md border-t border-l border-border bg-background">
        {v.kind === 'login' ? (
          <>
            <header className="flex items-center gap-3 border-b border-border bg-panel px-4 py-2">
              <LogIn className="size-4 text-primary" />
              <b className="flex-1 text-sm font-semibold">Log in: finish in the terminal, then press Done</b>
              <Button variant="default" onClick={actions.closeLogin}><Check />Done</Button>
            </header>
            <Terminal sessionId={v.key} />
          </>
        ) : v.kind === 'settings' ? (
          <SettingsPanel />
        ) : v.kind === 'tools' ? (
          <ProjectTools key={v.projectId} projectId={v.projectId} />
        ) : v.kind === 'grid' ? (
          <Grid />
        ) : v.kind === 'new' ? (
          <NewSessionForm key={v.projectId} projectId={v.projectId} />
        ) : session ? (
          <SessionView key={session.id} session={session} />
        ) : (
          <Empty icon={FolderPlus}>Add a project, then start a session.<br /><Button variant="default" className="mt-3" onClick={() => void actions.addProject()}>Add project</Button></Empty>
        )}
      </main>
      <Toasts />
      <Palette />
    </div>
  )
}
