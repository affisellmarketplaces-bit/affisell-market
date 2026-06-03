import { getTranslations } from "next-intl/server"

import { DemoSandboxPortal } from "@/components/demo/demo-sandbox-portal"
import { getDemoLabPublicState } from "@/lib/demo/demo-accounts-config"
import { DEMO_PERSONAS, type DemoPersonaKey } from "@/lib/demo/demo-shared"

type Props = {
  focusPersona?: DemoPersonaKey
}

export async function DemoSandboxPortalSection({ focusPersona }: Props) {
  const t = await getTranslations("demoLab.demoAccounts")
  const { enabled, configured } = getDemoLabPublicState()

  const personas = Object.fromEntries(
    DEMO_PERSONAS.map((p) => [
      p,
      { title: t(`personas.${p}.title`), hint: t(`personas.${p}.hint`) },
    ])
  ) as Record<
    DemoPersonaKey,
    { title: string; hint: string }
  >

  return (
    <DemoSandboxPortal
      enabled={enabled}
      configured={configured}
      focusPersona={focusPersona}
      labels={{
        eyebrow: t("eyebrow"),
        title: t("title"),
        subtitle: t("subtitle"),
        badge: t("badge"),
        enter: t("enter"),
        entering: t("entering"),
        disabled: t("disabled"),
        notConfigured: t("notConfigured"),
        rateLimited: t("rateLimited"),
        signinFailed: t("signinFailed"),
        personas,
      }}
    />
  )
}
