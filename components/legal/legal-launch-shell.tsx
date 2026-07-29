import Link from "next/link"
import type { ReactNode } from "react"

import { BentoContainer, BentoShell } from "@/components/affisell/bento-ui"
import { AFFISELL_LEGAL_IDENTITY, LEGAL_LAUNCH_VERSION } from "@/lib/legal/auto-entreprise-identity"
import { readCompanyLegal } from "@/lib/legal/company-env"
import { cn } from "@/lib/utils"

const NAV = [
  { href: "/legal/mentions-legales", label: "Mentions légales" },
  { href: "/legal/cgv", label: "CGV" },
  { href: "/legal/cgu", label: "CGU" },
  { href: "/legal/confidentialite", label: "Confidentialité" },
  { href: "/legal/cookies", label: "Cookies" },
  { href: "/legal/retractation", label: "Rétractation" },
] as const

export function LegalIdentityBanner() {
  const c = readCompanyLegal()
  return (
    <aside className="rounded-2xl border border-violet-200/70 bg-gradient-to-br from-violet-50/90 via-white to-sky-50/80 p-4 text-sm text-zinc-700 shadow-sm dark:border-violet-800/40 dark:from-violet-950/40 dark:via-zinc-950 dark:to-sky-950/30 dark:text-zinc-300">
      <p className="font-medium text-zinc-900 dark:text-white">
        Entreprise individuelle {c.legalName} — marque commerciale {c.name}
      </p>
      <p className="mt-1 text-xs leading-relaxed text-zinc-600 dark:text-zinc-400">
        SIRET {c.siret} · SIREN {c.siren} · NAF {c.naf} · {c.vatRegime || AFFISELL_LEGAL_IDENTITY.vatRegimeFr}
      </p>
    </aside>
  )
}

export function LegalLaunchShell({
  title,
  description,
  children,
}: {
  title: string
  description: string
  children: ReactNode
}) {
  return (
    <BentoShell>
      <BentoContainer maxWidth="4xl" className="space-y-8 py-10 sm:py-14">
        <nav aria-label="Documents légaux" className="flex flex-wrap gap-2">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-full border border-zinc-200 bg-white/90 px-3 py-1 text-xs font-medium text-zinc-700 transition hover:border-violet-300 hover:text-violet-800 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <header className="space-y-3 border-b border-zinc-200 pb-6 dark:border-zinc-800">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-violet-600 dark:text-violet-400">
            Affisell · Conformité
          </p>
          <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-white">{title}</h1>
          <p className="max-w-2xl text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">{description}</p>
          <p className="text-xs text-zinc-500">Dernière mise à jour : {LEGAL_LAUNCH_VERSION}</p>
        </header>

        <LegalIdentityBanner />

        <div className="space-y-8">{children}</div>
      </BentoContainer>
    </BentoShell>
  )
}

export function LegalSection({
  id,
  title,
  children,
  className,
}: {
  id: string
  title: string
  children: ReactNode
  className?: string
}) {
  return (
    <section
      id={id}
      aria-labelledby={`${id}-title`}
      className={cn(
        "rounded-2xl border border-zinc-200/80 bg-white/80 p-5 shadow-sm backdrop-blur-sm dark:border-zinc-800 dark:bg-zinc-950/60 sm:p-6",
        className
      )}
    >
      <h2 id={`${id}-title`} className="text-lg font-semibold tracking-tight text-zinc-900 dark:text-white">
        {title}
      </h2>
      <div className="mt-3 space-y-3 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">{children}</div>
    </section>
  )
}
