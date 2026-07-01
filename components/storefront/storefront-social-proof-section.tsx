import { Quote } from "lucide-react"

import {
  sectionCopyString,
  type HomepageSectionContent,
} from "@/lib/storefront-sections-shared"
import { cn } from "@/lib/utils"

type Props = {
  content?: HomepageSectionContent
  className?: string
  labels: {
    quote: string
    author: string
    stat: string
  }
}

export function StorefrontSocialProofSection({ content, className, labels }: Props) {
  const quote = sectionCopyString(content, "quote", labels.quote)
  const author = sectionCopyString(content, "author", labels.author)
  const stat = sectionCopyString(content, "stat", labels.stat)

  return (
    <section
      className={cn(
        "border-b border-zinc-200/80 bg-zinc-50/80 dark:border-zinc-800 dark:bg-zinc-900/40",
        className
      )}
    >
      <div className="mx-auto max-w-3xl px-4 py-10 text-center sm:px-6">
        <Quote className="mx-auto size-8 text-violet-500/70" aria-hidden />
        <blockquote className="mt-4 text-lg font-medium leading-relaxed text-zinc-800 dark:text-zinc-200">
          &ldquo;{quote}&rdquo;
        </blockquote>
        <p className="mt-3 text-sm font-semibold text-zinc-900 dark:text-zinc-100">{author}</p>
        <p className="mt-1 text-xs font-medium uppercase tracking-wider text-violet-700 dark:text-violet-300">
          {stat}
        </p>
      </div>
    </section>
  )
}
