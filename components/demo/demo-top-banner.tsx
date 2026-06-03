import Link from "next/link"
import { getTranslations } from "next-intl/server"
import { Sparkles } from "lucide-react"

export async function DemoTopBanner() {
  const t = await getTranslations("demoLab")

  return (
    <div
      className="sticky top-0 z-30 border-b border-violet-500/25 bg-zinc-950/95 px-4 py-2 text-center text-white backdrop-blur-md"
      role="status"
    >
      <p className="inline-flex items-center justify-center gap-2 text-xs font-semibold tracking-wide text-violet-200">
        <Sparkles className="h-3.5 w-3.5 shrink-0 text-violet-400" aria-hidden />
        {t("banner")}
        <Link href="/demo" className="ml-2 underline underline-offset-2 hover:text-white">
          {t("backToDemo")}
        </Link>
      </p>
    </div>
  )
}
