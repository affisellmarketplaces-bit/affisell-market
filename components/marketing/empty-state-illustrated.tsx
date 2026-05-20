import Image from "next/image"
import type { ReactNode } from "react"

type Props = {
  title: string
  description: string
  action?: ReactNode
}

/** Illustrated empty state (undraw-style SVG). */
export function EmptyStateIllustrated({ title, description, action }: Props) {
  return (
    <div className="flex flex-col items-center px-6 py-12 text-center">
      <Image
        src="/illustrations/empty-search.svg"
        alt=""
        width={200}
        height={160}
        className="opacity-90"
        priority={false}
      />
      <h3 className="mt-6 text-lg font-semibold text-zinc-900 dark:text-zinc-50">{title}</h3>
      <p className="mt-2 max-w-sm text-sm text-zinc-600 dark:text-zinc-400">{description}</p>
      {action ? <div className="mt-6">{action}</div> : null}
    </div>
  )
}
