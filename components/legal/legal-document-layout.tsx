import Link from "next/link"

import { BentoContainer, BentoShell } from "@/components/affisell/bento-ui"
import { LegalMarkdown } from "@/components/legal/legal-markdown"
import type { LegalDocMeta } from "@/lib/legal/types"
import { cn } from "@/lib/utils"

type Props = {
  meta: LegalDocMeta
  content: string
  headings: { id: string; text: string; level: number }[]
  allDocs: LegalDocMeta[]
}

export function LegalDocumentLayout({ meta, content, headings, allDocs }: Props) {
  const toc = headings.filter((h) => h.level <= 3)

  return (
    <BentoShell>
      <BentoContainer maxWidth="6xl" className="py-10 sm:py-14">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-violet-600 dark:text-violet-400">
              Documents légaux
            </p>
            <h1 className="mt-1 text-3xl font-bold tracking-tight text-zinc-900 dark:text-white">{meta.title}</h1>
            {meta.description ? (
              <p className="mt-2 max-w-2xl text-sm text-zinc-600 dark:text-zinc-400">{meta.description}</p>
            ) : null}
            <p className="mt-2 text-xs text-zinc-500">Dernière mise à jour : {meta.lastUpdated}</p>
          </div>
          <Link
            href="/legal/mentions"
            className="text-sm font-medium text-violet-700 underline-offset-4 hover:underline dark:text-violet-300"
          >
            Mentions légales
          </Link>
        </div>

        <div className="grid gap-10 lg:grid-cols-[220px_minmax(0,1fr)] xl:grid-cols-[240px_minmax(0,1fr)_200px]">
          <aside className="lg:sticky lg:top-24 lg:self-start">
            <nav aria-label="Documents légaux" className="space-y-1">
              {allDocs.map((doc) => (
                <Link
                  key={doc.slug}
                  href={`/legal/${doc.slug}`}
                  className={cn(
                    "block rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                    doc.slug === meta.slug
                      ? "bg-violet-100 text-violet-900 dark:bg-violet-950/60 dark:text-violet-100"
                      : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-900"
                  )}
                >
                  {doc.title}
                </Link>
              ))}
            </nav>
          </aside>

          <article className="min-w-0 rounded-2xl border border-zinc-200/80 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950 sm:p-8">
            <LegalMarkdown content={content} />
          </article>

          {toc.length > 0 ? (
            <aside className="hidden xl:block xl:sticky xl:top-24 xl:self-start">
              <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Sommaire</p>
              <ul className="mt-3 space-y-2 text-sm">
                {toc.map((h) => (
                  <li key={h.id} style={{ paddingLeft: (h.level - 1) * 12 }}>
                    <a
                      href={`#${h.id}`}
                      className="text-zinc-600 hover:text-violet-700 dark:text-zinc-400 dark:hover:text-violet-300"
                    >
                      {h.text}
                    </a>
                  </li>
                ))}
              </ul>
            </aside>
          ) : null}
        </div>
      </BentoContainer>
    </BentoShell>
  )
}
