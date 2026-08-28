import Link from "next/link"

import { BentoCard, BentoContainer, BentoShell } from "@/components/affisell/bento-ui"

type PageProps = {
  searchParams: Promise<{ ip?: string; score?: string }>
}

export default async function ShieldBlockedPage({ searchParams }: PageProps) {
  const params = await searchParams
  const ip = params.ip?.trim() || "—"
  const score = params.score?.trim() || "0"

  return (
    <BentoShell className="bg-zinc-50/90">
      <BentoContainer maxWidth="4xl">
        <BentoCard className="mx-auto max-w-lg text-center shadow-lg">
          <div className="text-5xl" aria-hidden>
            🛡️
          </div>
          <h1 className="mt-4 text-2xl font-bold tracking-tight text-zinc-900">
            Affisell Humanoid Shield
          </h1>
          <p className="mt-2 text-sm text-zinc-600">
            Cette requête a été interceptée avant d&apos;atteindre l&apos;application.
          </p>
          <dl className="mt-6 grid gap-3 rounded-2xl border border-zinc-200 bg-zinc-50/80 px-4 py-3 text-left text-sm">
            <div className="flex items-center justify-between gap-3">
              <dt className="font-medium text-zinc-500">IP</dt>
              <dd className="font-mono text-xs font-semibold text-zinc-900">{ip}</dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="font-medium text-zinc-500">Score humain</dt>
              <dd className="font-semibold tabular-nums text-zinc-900">{score}/100</dd>
            </div>
          </dl>
          <Link
            href="/"
            className="mt-8 inline-flex items-center justify-center rounded-full bg-zinc-900 px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-zinc-800"
          >
            Retour à l&apos;accueil
          </Link>
        </BentoCard>
      </BentoContainer>
    </BentoShell>
  )
}
