"use client"

import { useEffect, useRef } from "react"

import type { AppLocale } from "@/lib/i18n-locale"
import { readLocaleFromDocumentCookie } from "@/lib/i18n-messages-client"

type Props = {
  serverLocale: AppLocale
}

/**
 * If cookie and server-rendered locale diverge, reload once so RSC + client share one language.
 */
export function LocaleServerSync({ serverLocale }: Props) {
  const reloaded = useRef(false)

  useEffect(() => {
    if (reloaded.current) return
    const cookieLocale = readLocaleFromDocumentCookie()
    if (cookieLocale !== serverLocale) {
      reloaded.current = true
      window.location.reload()
    }
  }, [serverLocale])

  return null
}
