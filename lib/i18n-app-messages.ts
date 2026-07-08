import type { AppLocale } from "@/lib/i18n-locale"
import { CLIENT_MESSAGES } from "@/lib/i18n-load-messages"

export type AppMessages = typeof import("@/messages/en.json")

/** Typed EN-shaped messages for client components (locale merges keep the same keys). */
export function appMessagesForLocale(locale: AppLocale): AppMessages {
  return CLIENT_MESSAGES[locale] as unknown as AppMessages
}
