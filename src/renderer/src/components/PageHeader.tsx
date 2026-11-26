import { ProjectAvatar } from './Avatar'

/** Title bar for full-page views (New session, Project tools, Login): title, project, optional right-side action. */
export default function PageHeader({ title, project, children }: { title: string; project?: string; children?: React.ReactNode }): React.JSX.Element {
  return (
    <header className="flex h-12 shrink-0 items-center gap-2 border-b border-border px-4 pt-1 [-webkit-app-region:drag] [&_button]:[-webkit-app-region:no-drag]">
      <h1 className="text-title">{title}</h1>
      {project && <span className="flex items-center gap-1.5 text-body text-muted-foreground"><ProjectAvatar name={project} size={20} />{project}</span>}
      <div className="ml-auto flex items-center gap-2">{children}</div>
    </header>
  )
}
