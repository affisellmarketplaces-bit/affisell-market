import type { AbstractIntlMessages } from "next-intl"
import { getLocale, setRequestLocale } from "next-intl/server"

import { routing } from "@/i18n/routing"
import { DEFAULT_LOCALE, type AppLocale } from "@/lib/i18n-locale"
import { loadAppMessages } from "@/lib/i18n-load-messages"
import {
  isDynamicServerUsageError,
  resolveRequestLocale,
} from "@/lib/resolve-request-locale"

export type RootShellBootstrap = {
  locale: AppLocale
  messages: AbstractIntlMessages
  now: Date
}

let loggedMissingProductionEnv = false

function logMissingProductionEnvOnce() {
  if (loggedMissingProductionEnv || process.env.NEXT_PHASE === "phase-production-build") return
  if (process.env.NODE_ENV !== "production") return
  loggedMissingProductionEnv = true
  if (!process.env.DATABASE_URL?.trim()) {
    console.error("[bootstrapRootShell] DATABASE_URL is missing on this deployment")
  }
  if (!process.env.AUTH_SECRET?.trim() && !process.env.NEXTAUTH_SECRET?.trim()) {
    console.error("[bootstrapRootShell] AUTH_SECRET / NEXTAUTH_SECRET is missing on this deployment")
  }
}

/**
 * Intl + request locale for root layout.
 * Enables static pages: `setRequestLocale` + locale resolution without throwing on `headers()`.
 */
export async function bootstrapRootShell(): Promise<RootShellBootstrap> {
  logMissingProductionEnvOnce()

  try {
    setRequestLocale(routing.defaultLocale)
  } catch {
    /* static build — request store may be unavailable */
  }

  let locale: AppLocale = DEFAULT_LOCALE
  try {
    const fromIntl = await getLocale()
    locale = await resolveRequestLocale(
      typeof fromIntl === "string" ? fromIntl : undefined
    )
  } catch (error) {
    if (!isDynamicServerUsageError(error)) {
      console.warn("[bootstrapRootShell] getLocale failed, resolving locale manually", error)
    }
    locale = await resolveRequestLocale(undefined)
  }

  try {
    setRequestLocale(locale)
  } catch {
    /* ignore */
  }

  const messages = loadAppMessages(locale)
  return { locale, messages, now: new Date() }
}
