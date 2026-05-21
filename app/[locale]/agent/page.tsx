import { Suspense } from "react"
import { redirect } from "next/navigation"
import { setRequestLocale } from "next-intl/server"

import { AgentChat } from "@/components/AgentChat"
import { auth } from "@/auth"
import { AFFILIATE_AGENT_PATH } from "@/lib/affiliate-routes"

export const dynamic = "force-dynamic"
export const revalidate = 0

export const metadata = {
  title: "Agent shopping — Affisell",
  description: "Conseiller shopping IA pour les acheteurs — découvrez et comparez les produits du marketplace.",
}

type Props = { params: Promise<{ locale: string }> }

export default async function AgentLocalePage({ params }: Props) {
  const { locale } = await params
  setRequestLocale(locale)

  const session = await auth()
  if (session?.user?.role === "AFFILIATE") {
    redirect(AFFILIATE_AGENT_PATH)
  }
  if (session?.user?.role === "SUPPLIER") {
    redirect("/dashboard/supplier")
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-10 md:px-8">
      <div className="mb-8 text-center">
        <p className="text-xs font-semibold uppercase tracking-wider text-violet-400">Acheteur</p>
        <h1 className="mt-2 bg-gradient-to-r from-violet-400 to-pink-400 bg-clip-text text-4xl font-bold text-transparent md:text-5xl">
          Trouvez. Comparez. Achetez.
        </h1>
        <p className="mt-2 text-zinc-400">
          Votre conseiller shopping IA — recherche dans le marketplace en temps réel
        </p>
      </div>
      <Suspense fallback={<div className="h-96 animate-pulse rounded-2xl bg-zinc-800/50" aria-hidden />}>
        <AgentChat />
      </Suspense>
    </main>
  )
}
