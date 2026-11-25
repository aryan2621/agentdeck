import { useEffect, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { createHighlighterCore, type HighlighterCore, type ThemedToken } from 'shiki/core'
import { createJavaScriptRegexEngine } from 'shiki/engine/javascript'

const LANGS = {
  ts: import('shiki/langs/typescript.mjs'), tsx: import('shiki/langs/tsx.mjs'), js: import('shiki/langs/javascript.mjs'), jsx: import('shiki/langs/jsx.mjs'),
  json: import('shiki/langs/json.mjs'), bash: import('shiki/langs/bash.mjs'), python: import('shiki/langs/python.mjs'), css: import('shiki/langs/css.mjs'),
  html: import('shiki/langs/html.mjs'), diff: import('shiki/langs/diff.mjs'), yaml: import('shiki/langs/yaml.mjs'), md: import('shiki/langs/markdown.mjs'),
  go: import('shiki/langs/go.mjs'), rust: import('shiki/langs/rust.mjs'), sql: import('shiki/langs/sql.mjs')
}
const THEMES = { light: 'github-light', dark: 'github-dark-default' }
// JS regex engine: the WASM one needs 'wasm-unsafe-eval' in the CSP.
let hl: Promise<HighlighterCore> | undefined
const highlighter = (): Promise<HighlighterCore> =>
  (hl ??= createHighlighterCore({
    themes: [import('shiki/themes/github-light.mjs'), import('shiki/themes/github-dark-default.mjs')],
    langs: Object.values(LANGS),
    engine: createJavaScriptRegexEngine()
  }))

const EXT: Record<string, string> = { mjs: 'js', cjs: 'js', yml: 'yaml', py: 'python', rs: 'rust', sh: 'bash', zsh: 'bash', md: 'md' }
/** Per-line shiki tokens for a file's text (null until ready or for unknown extensions). Colours are CSS vars, see app.css. */
export function useTokens(code: string, path: string): ThemedToken[][] | null {
  const [lines, setLines] = useState<ThemedToken[][] | null>(null)
  const ext = path.split('.').pop() ?? ''
  const lang = EXT[ext] ?? ext
  useEffect(() => {
    let live = true
    highlighter().then((h) => {
      if (live && lang in LANGS) setLines(h.codeToTokens(code, { lang, themes: THEMES, defaultColor: false }).tokens)
    }, () => {})
    return () => { live = false }
  }, [code, lang])
  return lines
}

/** Highlighted block; shows plain text until shiki is ready or if the language is unknown. Colours follow the OS theme via CSS vars (app.css). */
export function CodeBlock({ code, lang }: { code: string; lang?: string }): React.JSX.Element {
  const [html, setHtml] = useState('')
  useEffect(() => {
    let live = true
    highlighter().then((h) => {
      if (live && lang && lang in LANGS) setHtml(h.codeToHtml(code, { lang, themes: THEMES, defaultColor: false }))
    }, () => {})
    return () => { live = false }
  }, [code, lang])
  return html ? (
    <div className="shiki-host overflow-x-auto rounded-md border border-border bg-card text-xs [&_pre]:p-2.5 [&_pre]:font-mono" dangerouslySetInnerHTML={{ __html: html }} />
  ) : (
    <pre className="overflow-x-auto rounded-md border border-border bg-card p-2.5 font-mono text-xs">{code}</pre>
  )
}

export default function Markdown({ text }: { text: string }): React.JSX.Element {
  return (
    <div className="flex flex-col gap-2 leading-relaxed break-words [&_a]:text-primary [&_a]:underline [&_li]:ml-4 [&_ol]:list-decimal [&_ul]:list-disc [&_table]:text-xs [&_td]:border [&_td]:border-border [&_td]:px-2 [&_th]:border [&_th]:border-border [&_th]:px-2 [&_h1]:text-base [&_h1]:font-semibold [&_h2]:font-semibold [&_h3]:font-semibold">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          pre: ({ children }) => <>{children}</>,
          code: ({ className, children }) => {
            const lang = /language-(\w+)/.exec(className ?? '')?.[1]
            const code = String(children)
            return lang || code.includes('\n') ? <CodeBlock code={code.replace(/\n$/, '')} lang={lang} /> : <code className="rounded-sm bg-muted px-1 font-mono text-xs">{children}</code>
          }
        }}
      >
        {text}
      </ReactMarkdown>
    </div>
  )
}
