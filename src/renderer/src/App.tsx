import Dashboard from './components/Dashboard'
import { PaneActive } from './lib/pane'
import Compare from './components/Compare'
import { useEffect, useState } from 'react'
import NewSessionForm from './components/NewSessionForm'
import SessionView from './components/SessionView'
import Terminal from './components/Terminal'
import InitRepoDialog from './components/InitRepoDialog'
import SettingsNav from './components/SettingsNav'
import Sidebar from './components/Sidebar'
import { Resizer } from './components/ui/resizer'
import SettingsPanel from './components/SettingsPanel'
import Palette from './components/Palette'
import Toasts from './components/Toasts'
import { Button } from './components/ui/button'
import Welcome from './components/Welcome'
import Home from './components/Home'
import ProjectDialog from './components/ProjectDialog'
import PageHeader from './components/PageHeader'
import { cn } from './lib/utils'
import { applyAppearance } from './lib/themes'
import { applyTypography } from './lib/fonts'
import { actions, findSession, useStore } from './store'

const SIDE_MIN = 256
const SIDE_MAX = 400

export default function App(): React.JSX.Element {
  const s = useStore()
  useEffect(() => {
    void actions.load()
    const offs = [window.api.onSessionUpdated(actions.upsertSession), window.api.onSelectSession(actions.select)]
    return () => offs.forEach((o) => o())
  }, [])
  const { colorTheme, lowContrast, seasonal, accessibleColors } = s.settings
  useEffect(() => {
    applyAppearance({ colorTheme, lowContrast, seasonal, accessibleColors })
    const mq = matchMedia('(prefers-color-scheme: dark)') // --link/--ring depend on the scheme
    const f = (): void => applyAppearance({ colorTheme, lowContrast, seasonal, accessibleColors })
    mq.addEventListener('change', f)
    return () => mq.removeEventListener('change', f)
  }, [colorTheme, lowContrast, seasonal, accessibleColors])
  const { monoFont, codeLigatures, markdownStyle } = s.settings
  useEffect(() => applyTypography({ monoFont, codeLigatures, markdownStyle }), [monoFont, codeLigatures, markdownStyle])
  const inSettings = s.view.kind === 'settings'
  const collapsed = s.sidebarCollapsed && !inSettings
  const [sideW, setSideW] = useState(() => Math.min(SIDE_MAX, Math.max(SIDE_MIN, Number(localStorage.getItem('sideW')) || 256)))
  const resizeSide = (w: number): void => {
    const v = Math.min(SIDE_MAX, Math.max(SIDE_MIN, Math.round(w)))
    setSideW(v)
    localStorage.setItem('sideW', String(v))
  }
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.metaKey && !e.shiftKey && !e.altKey && e.key === 'b') { e.preventDefault(); actions.toggleSidebar() }
      if (e.key === 'Escape' && !e.defaultPrevented && !document.querySelector('[role="dialog"],[cmdk-root]')) actions.closeSettings()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
  const session = findSession(s, s.selectedId)
  const v = s.view
  const other = s.split && s.split !== session?.id ? findSession(s, s.split) : undefined
  const [pane, setPane] = useState(0)
  return (
    <div className={cn('grid h-full bg-chrome', collapsed && 'grid-cols-[72px_minmax(0,1fr)]')} style={collapsed ? undefined : { gridTemplateColumns: `${sideW}px minmax(0,1fr)` }}>
      <div className="fixed inset-x-0 top-0 z-40 h-3 [-webkit-app-region:drag]" aria-hidden />
      {inSettings ? <SettingsNav /> : <Sidebar rail={collapsed} />}
      <main className={cn('relative flex min-h-0 min-w-0 flex-col overflow-hidden border-l border-border bg-background')}>
        {!collapsed && (
          <Resizer label="Resize sidebar" value={sideW} min={SIDE_MIN} max={SIDE_MAX} onDrag={resizeSide} onNudge={(d) => resizeSide(sideW + d * 16)} onReset={() => resizeSide(256)} className="absolute inset-y-0 -left-px z-20" />
        )}
        {v.kind === 'login' ? (
          <>
            <PageHeader title="Log in"><Button variant="default" onClick={actions.closeLogin}>Done</Button></PageHeader>
            <p className="px-4 py-2 text-small text-muted-foreground">Finish logging in in the terminal, then press Done.</p>
            <Terminal sessionId={v.key} />
          </>
        ) : v.kind === 'dashboard' ? (
          <Dashboard />
        ) : v.kind === 'compare' ? (
          <Compare groupId={v.groupId} />
        ) : v.kind === 'settings' ? (
          <SettingsPanel />
        ) : session && other ? (
          <div className="grid min-h-0 flex-1 grid-cols-2">
            {[session, other].map((x, i) => (
              <PaneActive.Provider key={x.id} value={pane === i}>
                <div className={cn('flex min-h-0 min-w-0 flex-col overflow-hidden', i === 0 && 'border-r border-border')} onPointerDownCapture={() => setPane(i)} onFocusCapture={() => setPane(i)}>
                  <SessionView session={x} />
                </div>
              </PaneActive.Provider>
            ))}
          </div>
        ) : session ? (
          <SessionView key={session.id} session={session} />
        ) : (
          Object.values(s.sessions).some((list) => list.length > 0) ? <Home /> : <Welcome />
        )}
      </main>
      {v.kind === 'new' && <NewSessionForm key={v.projectId} projectId={v.projectId} />}
      <InitRepoDialog />
      <ProjectDialog />
      <Toasts />
      <Palette />
    </div>
  )
}
