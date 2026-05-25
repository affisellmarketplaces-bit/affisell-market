import type { AbstractIntlMessages } from "next-intl"
import { getLocale, getMessages, setRequestLocale } from "next-intl/server"

import { DEFAULT_LOCALE, resolveAppLocale, type AppLocale } from "@/lib/i18n-locale"

async function loadMessagesFallback(locale: AppLocale): Promise<AbstractIntlMessages> {
  const mod = await import(`../messages/${locale}.json`)
  return mod.default as AbstractIntlMessages
}

export type RootShellBootstrap = {
  locale: AppLocale
  messages: AbstractIntlMessages
  now: Date
}

function logMissingProductionEnv() {
  if (process.env.NODE_ENV !== "production") return
  if (!process.env.DATABASE_URL?.trim()) {
    console.error("[bootstrapRootShell] DATABASE_URL is missing on this deployment")
  }
  if (!process.env.AUTH_SECRET?.trim() && !process.env.NEXTAUTH_SECRET?.trim()) {
    console.error("[bootstrapRootShell] AUTH_SECRET / NEXTAUTH_SECRET is missing on this deployment")
  }
}

/** Intl + request locale for root layout — never crash the whole app on misconfig. */
export async function bootstrapRootShell(): Promise<RootShellBootstrap> {
  logMissingProductionEnv()
  try {
    const locale = resolveAppLocale(await getLocale())
    setRequestLocale(locale)
    const messages = await getMessages()
    return { locale, messages, now: new Date() }
  } catch (error) {
    console.error("[bootstrapRootShell] falling back to default locale", error)
    const locale = DEFAULT_LOCALE
    try {
      setRequestLocale(locale)
    } catch {
      /* ignore */
    }
    const messages = await loadMessagesFallback(locale)
    return { locale, messages, now: new Date() }
  }
}
