import Link from "next/link"
import { CheckCircle2, Circle, Package, Share2, Store } from "lucide-react"

import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type Props = {
  storeSlug: string | null
}

const steps = [
  {
    id: "create",
    label: "Créer votre première fiche produit",
    href: "/dashboard/supplier/products/new",
    Icon: Package,
  },
  {
    id: "publish",
    label: "Publier sur le marketplace",
    href: "/dashboard/supplier/products",
    Icon: Store,
  },
  {
    id: "share",
    label: "Partager votre catalogue fournisseur",
    href: null as string | null,
    Icon: Share2,
  },
] as const

export function SupplierOnboardingChecklist({ storeSlug }: Props) {
  const shareHref = storeSlug ? `/store/supplier/${storeSlug}` : "/marketplace"

  return (
    <section
      aria-labelledby="onboarding-heading"
      className="rounded-2xl border border-violet-200/80 bg-gradient-to-br from-violet-50/80 via-white to-white p-6 shadow-sm dark:border-violet-900/50 dark:from-violet-950/30 dark:via-zinc-950 dark:to-zinc-950"
    >
      <h2 id="onboarding-heading" className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
        Démarrez votre boutique
      </h2>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
        Trois étapes pour passer de zéro à votre première vente affiliée.
      </p>
      <ol className="mt-5 space-y-3">
        {steps.map((step, index) => {
          const href = step.id === "share" ? shareHref : step.href!
          const done = false
          return (
            <li key={step.id} className="flex items-start gap-3">
              {done ? (
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" aria-hidden />
              ) : (
                <Circle className="mt-0.5 h-5 w-5 shrink-0 text-zinc-300 dark:text-zinc-600" aria-hidden />
              )}
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
                  <span className="text-zinc-400">{index + 1}. </span>
                  {step.label}
                </p>
                <Link
                  href={href}
                  className={cn(
                    buttonVariants({ variant: "outline", size: "sm" }),
                    "mt-2 gap-1.5 border-violet-200"
                  )}
                >
                  <step.Icon className="h-3.5 w-3.5" aria-hidden />
                  Commencer
                </Link>
              </div>
            </li>
          )
        })}
      </ol>
    </section>
  )
}
