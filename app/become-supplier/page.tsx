import type { Metadata } from "next"
import Link from "next/link"
import { getTranslations } from "next-intl/server"

import { RotatingSloganPro } from "@/components/ui/RotatingSloganPro"
import { buttonVariants } from "@/components/ui/button"
import { SLOGAN_SYSTEM } from "@/lib/slogans/rotating-system"
import { cn } from "@/lib/utils"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("slogans.supplier")
  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
    openGraph: {
      title: t("metaTitle"),
      description: t("metaDescription"),
    },
  }
}

export default async function BecomeSupplierPage() {
  const t = await getTranslations("slogans.supplier")
  const phrases = t.raw("rotatifs") as string[]
  const cfg = SLOGAN_SYSTEM.supplier

  return (
    <main className={cn("min-h-screen text-white", cfg.pageBg)}>
      <noscript>
        <h1>{t("canonical")}</h1>
      </noscript>

      <section className="mx-auto max-w-7xl px-6 pb-16 pt-24">
        <div className="max-w-3xl">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-3 py-1 text-sm font-medium text-white/95 backdrop-blur">
            <span
              className="size-2 shrink-0 animate-pulse rounded-full bg-cyan-300"
              aria-hidden
            />
            {t("badge")}
          </div>

          <RotatingSloganPro
            persona="supplier"
            tone="dark"
            base={t("base")}
            phrases={phrases}
            fixedSuffix={t("fixedSuffix")}
            canonical={t("canonical")}
            className="text-left"
          />

          <p className="mt-6 text-lg leading-relaxed text-emerald-50/90">{t("sub")}</p>

          <p className="mt-4 text-sm font-medium tracking-wide text-emerald-100/80">{t("ticker")}</p>

          <div className="mt-8 flex flex-wrap gap-4">
            <Link
              href="/signup/supplier"
              className={cn(
                buttonVariants({ size: "lg" }),
                "rounded-full bg-white px-6 font-medium text-emerald-950 hover:bg-emerald-50"
              )}
            >
              {t("ctaPrimary")}
            </Link>
            <Link
              href="/sell/become-supplier"
              className={cn(
                buttonVariants({ variant: "outline", size: "lg" }),
                "rounded-full border-white/40 bg-transparent px-6 font-medium text-white hover:bg-white/10"
              )}
            >
              {t("ctaSecondary")}
            </Link>
          </div>
        </div>
      </section>
    </main>
  )
}
