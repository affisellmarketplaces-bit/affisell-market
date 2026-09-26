import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { getTranslations } from "next-intl/server"

import { BentoContainer, BentoPageHeading, BentoShell } from "@/components/affisell/bento-ui"
import { AiConnectPanel } from "@/components/ai-connect/ai-connect-panel"
import { effectiveToolRole } from "@/lib/ai-connect/tools"
import { loginSelectorPath } from "@/lib/login-redirect"
import { safeAuth } from "@/lib/safe-auth"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "Affisell — AI",
  robots: { index: false, follow: false },
}

export default async function AiConnectPage() {
  const session = await safeAuth()
  if (!session?.user?.id) redirect(loginSelectorPath("/dashboard/ai-connect"))
  if (!effectiveToolRole(session.user.role ?? "")) redirect("/dashboard")

  const t = await getTranslations("aiConnect")
  return (
    <BentoShell>
      <BentoContainer maxWidth="5xl" className="space-y-6 py-10">
        <BentoPageHeading eyebrow="MCP" title={t("title")} description={t("subtitle")} />
        <AiConnectPanel />
      </BentoContainer>
    </BentoShell>
  )
}
