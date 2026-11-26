import { useEffect, useState } from 'react'
import NewSessionForm from './components/NewSessionForm'
import SessionView from './components/SessionView'
import Terminal from './components/Terminal'
import ProjectTools from './components/ProjectTools'
import Sidebar from './components/Sidebar'
import * as D from '@radix-ui/react-dialog'
import SettingsPanel from './components/SettingsPanel'
import { LogIn } from 'lucide-react'
import Palette from './components/Palette'
import Toasts from './components/Toasts'
import { Button } from './components/ui/button'
import Welcome from './components/Welcome'
import { ProjectAvatar } from './components/Avatar'
import { cn } from './lib/utils'
import { actions, currentProjectId, findSession, useStore } from './store'

const SIDE_MIN = 240
const SIDE_MAX = 400

export default function App(): React.JSX.Element {
  const s = useStore()
  useEffect(() => {
    void actions.load()
    const offs = [window.api.onSessionUpdated(actions.upsertSession), window.api.onSelectSession(actions.select)]
    return () => offs.forEach((o) => o())
  }, [])
  const collapsed = s.sidebarCollapsed
  const [sideW, setSideW] = useState(() => Math.min(SIDE_MAX, Math.max(SIDE_MIN, Number(localStorage.getItem('sideW')) || 300)))
  const resizeSide = (w: number): void => {
    const v = Math.min(SIDE_MAX, Math.max(SIDE_MIN, Math.round(w)))
    setSideW(v)
    localStorage.setItem('sideW', String(v))
  }
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.metaKey && !e.shiftKey && !e.altKey && e.key === 'b') { e.preventDefault(); actions.toggleSidebar() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
  const session = findSession(s, s.selectedId)
  const v = s.view
  const project = s.projects.find((p) => p.id === currentProjectId(s))
  return (
    <div className={cn('grid h-full bg-chrome', collapsed && 'grid-cols-[72px_minmax(0,1fr)]')} style={collapsed ? undefined : { gridTemplateColumns: `${sideW}px minmax(0,1fr)` }}>
      <div className="fixed inset-x-0 top-0 z-40 h-3 [-webkit-app-region:drag]" aria-hidden />
      <Sidebar rail={collapsed} />
      <main className={cn('relative flex min-h-0 min-w-0 flex-col overflow-hidden border-l border-border bg-background')}>
        {!collapsed && (
          <div
            role="separator" aria-orientation="vertical" aria-label="Resize sidebar" tabIndex={0}
            aria-valuenow={sideW} aria-valuemin={SIDE_MIN} aria-valuemax={SIDE_MAX}
            className="absolute inset-y-0 -left-px z-20 w-1 cursor-col-resize transition-colors hover:bg-ring focus-visible:bg-ring"
            onPointerDown={(e) => e.currentTarget.setPointerCapture(e.pointerId)}
            onPointerMove={(e) => e.buttons === 1 && resizeSide(e.clientX)}
            onKeyDown={(e) => { if (e.key === 'ArrowLeft') resizeSide(sideW - 16); else if (e.key === 'ArrowRight') resizeSide(sideW + 16) }}
          />
        )}
        {project && (v.kind === 'tools' || v.kind === 'new') && (
          <div className="pointer-events-none absolute top-3 right-4 z-30 flex items-center gap-2 rounded-md border border-border bg-background py-1 pr-3 pl-1 text-body font-medium" title="Current project">
            <ProjectAvatar name={project.name} size={24} />{project.name}
          </div>
        )}
        {v.kind === 'login' ? (
          <>
            <header className="flex items-center gap-3 border-b border-border bg-panel px-4 py-2">
              <LogIn className="size-4 text-muted-foreground" />
              <b className="flex-1 text-title">Log in: finish in the terminal, then press Done</b>
              <Button variant="default" onClick={actions.closeLogin}>Done</Button>
            </header>
            <Terminal sessionId={v.key} />
          </>
        ) : v.kind === 'tools' ? (
          <ProjectTools key={v.projectId} projectId={v.projectId} />
        ) : v.kind === 'new' ? (
          <NewSessionForm key={v.projectId} projectId={v.projectId} />
        ) : session ? (
          <SessionView key={session.id} session={session} />
        ) : (
          <Welcome />
        )}
      </main>
      <D.Root open={v.kind === 'settings'} onOpenChange={(o) => !o && actions.closeSettings()}>
        <D.Portal>
          <D.Overlay className="fixed inset-0 z-50 bg-scrim" />
          <D.Content aria-describedby={undefined} className="fixed top-1/2 left-1/2 z-50 flex h-[min(40rem,88vh)] w-[min(54rem,94vw)] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-lg border border-border bg-overlay shadow-overlay">
            <D.Title className="sr-only">Settings</D.Title>
            <SettingsPanel />
          </D.Content>
        </D.Portal>
      </D.Root>
      <Toasts />
      <Palette />
    </div>
  )
}
