import { redirect } from "next/navigation"

import { SupplierKindSelector } from "@/components/supplier/SupplierKindSelector"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { parseSupplierKind } from "@/lib/supplier-kind"

export const dynamic = "force-dynamic"

/**
 * Isolated supplier kind onboarding (producer vs stocker).
 * Protected by proxy.ts `/dashboard/supplier/*` SUPPLIER guard.
 * Server load mirrors GET /api/supplier-profile/me (same DB contract, no cookie hop).
 */
export default async function SupplierKindOnboardingPage() {
  const session = await auth()
  if (!session?.user?.id) {
    redirect("/login/supplier?callbackUrl=/dashboard/supplier/onboarding/kind")
  }
  if (session.user.role !== "SUPPLIER") {
    redirect("/login/supplier")
  }

  const me = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, supplierKind: true, role: true, name: true },
  })

  if (!me) {
    redirect("/login/supplier?callbackUrl=/dashboard/supplier/onboarding/kind")
  }

  const initialKind = parseSupplierKind(me.supplierKind)

  return (
    <main className="relative min-h-[100dvh] overflow-hidden bg-zinc-50 dark:bg-zinc-950">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(124,58,237,0.08),transparent_40%)] dark:bg-[linear-gradient(180deg,rgba(124,58,237,0.14),transparent_45%)]"
      />
      <div className="relative mx-auto flex max-w-4xl flex-col gap-8 px-4 py-12 sm:px-6 sm:py-16">
        <header className="space-y-3 text-center sm:text-left">
          <p className="text-xs font-semibold tracking-[0.2em] text-[#7C3AED] uppercase">
            Affisell · Fournisseur
          </p>
          <h1 className="text-3xl font-semibold tracking-tight text-zinc-900 dark:text-white sm:text-4xl">
            Qui es-tu sur Affisell Radar ?
          </h1>
          <p className="max-w-2xl text-sm leading-relaxed text-zinc-600 dark:text-zinc-400 sm:text-base">
            Producteur ou stockeur — ton cockpit Radar (défense / attaque) s’adapte. Tu peux changer
            plus tard.
          </p>
        </header>

        <SupplierKindSelector initialKind={initialKind} initialName={me.name} />
      </div>
    </main>
  )
}
