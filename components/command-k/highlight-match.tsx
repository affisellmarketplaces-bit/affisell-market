type Props = {
  text: string
  query: string
}

export function HighlightMatch({ text, query }: Props) {
  const q = query.trim().toLowerCase()
  if (!q) return <>{text}</>
  const lower = text.toLowerCase()
  const idx = lower.indexOf(q)
  if (idx < 0) {
    return <>{text}</>
  }
  return (
    <>
      {text.slice(0, idx)}
      <mark className="rounded bg-violet-200/90 px-0.5 text-inherit dark:bg-violet-500/40">
        {text.slice(idx, idx + q.length)}
      </mark>
      {text.slice(idx + q.length)}
    </>
  )
}
