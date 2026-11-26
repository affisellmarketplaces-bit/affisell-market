"use client"

import { useMemo } from "react"
import { useLocale, useMessages, useNow, type AbstractIntlMessages } from "next-intl"

import { IntlAppProvider } from "@/components/providers/intl-app-provider"
import type { AppLocale } from "@/lib/i18n-locale"

/**
 * Adds namespaces to the messages already provided above (see lib/i18n-client-scope.ts). Rendered by `<IntlScope>` —
 * never directly: the extra namespaces are chosen on the server.
 */
export function IntlMessagesExtension({
  extra,
  children,
}: {
  extra: AbstractIntlMessages
  children: React.ReactNode
}) {
  const parent = useMessages()
  const locale = useLocale() as AppLocale
  const now = useNow()
  const merged = useMemo(() => ({ ...parent, ...extra }), [parent, extra])
  return (
    <IntlAppProvider locale={locale} messages={merged} now={now}>
      {children}
    </IntlAppProvider>
  )
}
