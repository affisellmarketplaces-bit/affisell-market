import { useTranslations } from "next-intl"

/** Legal disclaimer — World Radar opportunity signals (not live marketplace sales). */
export function RadarLegalDisclaimer({ className }: { className?: string }) {
  const t = useTranslations("radarShell")
  return (
    <div className={`mt-12 border-t border-zinc-200 pt-6 text-center dark:border-zinc-800 ${className ?? ""}`}>
      <p className="mx-auto max-w-3xl text-xs leading-relaxed text-zinc-500 sm:text-sm">
        {t("legalDisclaimer")}
      </p>
    </div>
  )
}
