import type { ReactNode } from "react"

import { normativeUrl, type NormativeId } from "@/lib/legal/normative-sources"
import { cn } from "@/lib/utils"

const LINK_CLASS =
  "font-semibold text-violet-700 underline underline-offset-2 hover:text-violet-900 dark:text-violet-300 dark:hover:text-violet-200"

export function NormativeExternalLink({
  href,
  children,
  className,
}: {
  href: string
  children: ReactNode
  className?: string
}) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={cn(LINK_CLASS, className)}>
      {children}
    </a>
  )
}

export function normativeRichTag(id: NormativeId, locale: string) {
  return (chunks: ReactNode) => (
    <NormativeExternalLink href={normativeUrl(id, locale)}>{chunks}</NormativeExternalLink>
  )
}

/** Tags for `t.rich` — national (FR), EU and international sources. */
export function buildNormativeRichTags(locale: string) {
  return {
    l22118: normativeRichTag("L221_18", locale),
    l22124: normativeRichTag("L221_24", locale),
    l22128: normativeRichTag("L221_28", locale),
    l2174: normativeRichTag("L217_4", locale),
    l6121: normativeRichTag("L612_1", locale),
    lcen: normativeRichTag("LCEN_2004_575", locale),
    cpi: normativeRichTag("CPI_L122_4", locale),
    gdpr: normativeRichTag("GDPR", locale),
    odr: normativeRichTag("EU_ODR_524_2013", locale),
    psd2: normativeRichTag("PSD2_2015_2366", locale),
    dir201183: normativeRichTag("DIRECTIVE_2011_83", locale),
    eprivacy: normativeRichTag("EPRIVACY_2002_58", locale),
    cnil: normativeRichTag("CNIL", locale),
  }
}
