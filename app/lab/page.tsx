import type { Metadata } from "next"
import Link from "next/link"
import { getTranslations } from "next-intl/server"
import { ArrowLeft } from "lucide-react"

import { MagicSystemsLabClient } from "@/components/lab/magic-systems-lab-client"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("magicSystems")
  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
    openGraph: {
      title: t("metaTitle"),
      description: t("metaDescription"),
    },
  }
}

export default async function MagicSystemsLabPage() {
  const t = await getTranslations("magicSystems")

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#070712] text-white">
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_70%_45%_at_20%_-5%,rgba(139,92,246,0.4),transparent),radial-gradient(ellipse_50%_40%_at_90%_10%,rgba(34,211,238,0.18),transparent)]"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.3] [background-image:linear-gradient(rgba(255,255,255,0.035)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.035)_1px,transparent_1px)] [background-size:44px_44px]"
        aria-hidden
      />

      <div className="relative">
        <div className="mx-auto max-w-6xl px-4 pt-8 sm:px-6">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-sm text-violet-200/80 transition hover:text-white"
          >
            <ArrowLeft className="size-4" aria-hidden />
            {t("backHome")}
          </Link>
        </div>
        <MagicSystemsLabClient />
      </div>
    </main>
  )
}
