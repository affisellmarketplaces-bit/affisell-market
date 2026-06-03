import Link from "next/link"
import { notFound } from "next/navigation"
import { getTranslations } from "next-intl/server"
import { ArrowLeft } from "lucide-react"

import { DemoJourney } from "@/components/demo/demo-journey"
import { buttonVariants } from "@/components/ui/button"
import { isDemoPersonaKey } from "@/lib/demo/demo-routes"
import type { DemoPersonaKey } from "@/lib/demo/demo-shared"
import { cn } from "@/lib/utils"

type Props = { params: Promise<{ persona: string }> }

export async function generateMetadata({ params }: Props) {
  const { persona } = await params
  if (!isDemoPersonaKey(persona)) return { title: "Demo | Affisell" }
  const t = await getTranslations("demoLab")
  return {
    title: `${t(`personas.${persona as DemoPersonaKey}.title`)} | Affisell Demo`,
    description: t(`personas.${persona as DemoPersonaKey}.subtitle`),
  }
}

export default async function DemoPersonaPage({ params }: Props) {
  const { persona } = await params
  if (!isDemoPersonaKey(persona)) notFound()

  const t = await getTranslations("demoLab")

  return (
    <>
      <Link
        href="/demo"
        className={cn(
          buttonVariants({ variant: "ghost", size: "sm" }),
          "-ml-2 mb-6 inline-flex gap-2 text-zinc-600 dark:text-zinc-300"
        )}
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        {t("backToDemo")}
      </Link>
      <DemoJourney persona={persona} />
    </>
  )
}
