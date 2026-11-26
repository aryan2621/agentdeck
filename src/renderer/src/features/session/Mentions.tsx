import { Fragment } from 'react'

const TOKEN = /((?:^|\s)@\S+|^\/\S+)/

/** Text with @file mentions and a leading /command marked. Pass `className` to style the marks. */
export default function Mentions({ text, className }: { text: string; className: string }): React.JSX.Element {
  return (
    <>
      {text.split(TOKEN).map((part, i) => {
        if (i % 2 === 0) return <Fragment key={i}>{part}</Fragment>
        const lead = part.length - part.trimStart().length
        return <Fragment key={i}>{part.slice(0, lead)}<mark className={className}>{part.slice(lead)}</mark></Fragment>
      })}
    </>
  )
}
