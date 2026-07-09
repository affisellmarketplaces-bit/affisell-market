import { Suspense } from "react"
import { redirect } from "next/navigation"

import { BentoCard, BentoContainer, BentoShell } from "@/components/affisell/bento-ui"
import { ReacceptLegalForm } from "@/components/legal/reaccept-legal-form"
import { auth } from "@/auth"
import { findFirstMissingDocumentSlug } from "@/lib/legal/acceptance"
import { getRequiredDocumentSlugs } from "@/lib/legal/required-documents"
import { resolveRequestLocale } from "@/lib/resolve-request-locale"

export const dynamic = "force-dynamic"

const DOC_LABELS: Record<string, string> = {
  customer: "Conditions Générales d'Utilisation",
  privacy: "Politique de confidentialité",
  supplier: "Conditions fournisseur",
  affiliate: "Conditions affilié",
}

type Props = {
  searchParams: Promise<{ doc?: string; returnTo?: string }>
}

export default async function ReacceptTermsPage({ searchParams }: Props) {
  const session = await auth()
  if (!session?.user?.id) {
    redirect("/login")
  }

  const role = session.user.role ?? "CUSTOMER"
  const params = await searchParams
  const locale = await resolveRequestLocale(undefined)
  const returnTo = params.returnTo?.trim() || defaultReturnTo(role)

  const missing = await findFirstMissingDocumentSlug(session.user.id, role)
  if (!missing) {
    redirect(`/api/legal/gate-sync?returnTo=${encodeURIComponent(returnTo)}`)
  }

  const docParam = params.doc?.trim()
  const doc =
    docParam && getRequiredDocumentSlugs(role).includes(docParam) ? docParam : missing

  const title = DOC_LABELS[doc] ?? doc

  return (
    <BentoShell>
      <BentoContainer maxWidth="4xl" className="py-12">
        <div className="text-center">
          <p className="text-xs font-semibold uppercase tracking-wider text-violet-600 dark:text-violet-400">
            Conformité légale
          </p>
          <h1 className="mt-2 text-2xl font-bold text-zinc-900 dark:text-white">
            Acceptation des conditions mises à jour
          </h1>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            Re-consentement obligatoire avant accès à votre espace.
          </p>
        </div>
        <BentoCard className="mx-auto mt-8 max-w-2xl p-6">
          <Suspense fallback={<p className="text-sm text-zinc-500">Chargement…</p>}>
            <ReacceptLegalForm
              docSlug={doc}
              docTitle={title}
              locale={locale}
              returnTo={returnTo}
            />
          </Suspense>
        </BentoCard>
      </BentoContainer>
    </BentoShell>
  )
}

function defaultReturnTo(role: string): string {
  if (role === "SUPPLIER") return "/dashboard/supplier"
  if (role === "AFFILIATE") return "/dashboard/affiliate"
  if (role === "ADMIN") return "/admin"
  return "/shops"
}
