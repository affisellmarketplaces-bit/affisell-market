import type { Metadata } from "next"
import Link from "next/link"

export const metadata: Metadata = {
  title: "Legal Notice | Affisell",
  description: "[TODO] Final EU legal copy to be inserted (GDPR, mediation, company IDs via NEXT_PUBLIC_* env).",
}

export default function EuLegalAliasPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-14 prose prose-zinc dark:prose-invert">
      <h1>Legal Notice</h1>
      <p className="not-prose rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-900 dark:text-amber-200">
        <strong>[TODO] Final EU legal copy to be inserted (GDPR, mediation, company IDs via NEXT_PUBLIC_* env).</strong>
      </p>
      <p className="not-prose text-sm text-zinc-600 dark:text-zinc-400">
        Interim canonical page:{" "}
        <Link href="/mentions-legales" className="font-medium text-violet-600 underline dark:text-violet-300">
          /mentions-legales
        </Link>
      </p>
    </main>
  )
}
