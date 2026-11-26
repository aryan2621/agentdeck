import { useEffect, useState } from 'react'
import { Check, Copy } from 'lucide-react'
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
function CodeBlock({ code, lang }: { code: string; lang?: string }): React.JSX.Element {
  const [html, setHtml] = useState('')
  useEffect(() => {
    let live = true
    highlighter().then((h) => {
      if (live && lang && lang in LANGS) setHtml(h.codeToHtml(code, { lang, themes: THEMES, defaultColor: false }))
    }, () => {})
    return () => { live = false }
  }, [code, lang])
  const [copied, setCopied] = useState(false)
  const copy = (): void => {
    void navigator.clipboard.writeText(code).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500) })
  }
  return (
    <div className="overflow-hidden rounded-md border border-border bg-background">
      <div className="flex h-7 items-center justify-between border-b border-border px-3 text-meta text-muted-foreground">
        <span className="font-mono">{lang ?? 'text'}</span>
        <button type="button" onClick={copy} className="inline-flex items-center gap-1 rounded-sm px-1 transition-colors duration-100 hover:text-foreground">
          {copied ? <Check className="size-3" /> : <Copy className="size-3" />}{copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      {html ? (
        <div className="shiki-host overflow-x-auto text-small [&_pre]:p-3 [&_pre]:font-mono" dangerouslySetInnerHTML={{ __html: html }} />
      ) : (
        <pre className="overflow-x-auto p-3 font-mono text-small">{code}</pre>
      )}
    </div>
  )
}

export default function Markdown({ text }: { text: string }): React.JSX.Element {
  return (
    <div className="flex flex-col gap-3 text-prose break-words [&_a]:text-link [&_li]:ml-4 [&_ol]:list-decimal [&_ul]:list-disc [&_table]:text-small [&_td]:border [&_td]:border-border [&_td]:px-2 [&_th]:border [&_th]:border-border [&_th]:px-2 [&_h1]:text-title [&_h1]:font-semibold [&_h2]:font-semibold [&_h3]:font-semibold">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          pre: ({ children }) => <>{children}</>,
          code: ({ className, children }) => {
            const lang = /language-(\w+)/.exec(className ?? '')?.[1]
            const code = String(children)
            return lang || code.includes('\n') ? <CodeBlock code={code.replace(/\n$/, '')} lang={lang} /> : <code className="rounded-sm bg-muted px-1 font-mono text-small">{children}</code>
          }
        }}
      >
        {text}
      </ReactMarkdown>
    </div>
  )
}
