import { getLocale } from "next-intl/server"

import { IntlMessagesExtension } from "@/components/providers/intl-messages-extension"
import { pickNamespaces } from "@/lib/i18n-client-scope"
import { loadAppMessages } from "@/lib/i18n-load-messages"
import { resolveAppLocale } from "@/lib/i18n-locale"

/**
 * Server component: makes `namespaces` available to the client components below it, on top of what the root layout
 * sent. Used by the `/dashboard` and `/admin` layouts (PRIVATE_SURFACE_NAMESPACES) and around the product detail.
 */
export async function IntlScope({
  namespaces,
  children,
}: {
  namespaces: readonly string[]
  children: React.ReactNode
}) {
  const locale = resolveAppLocale(await getLocale())
  const extra = pickNamespaces(loadAppMessages(locale), namespaces)
  return <IntlMessagesExtension extra={extra}>{children}</IntlMessagesExtension>
}
