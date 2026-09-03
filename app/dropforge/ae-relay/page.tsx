import { DropForgeAeRelayClient } from "@/components/import/dropforge-ae-relay-client"
import { createAeCaptureSession } from "@/lib/fulfillment/ae-capture-session"
import { createAeCaptureToken } from "@/lib/fulfillment/ae-capture-token"
import { validateDropForgeProductUrl } from "@/lib/dropforge-product-url"
import { DROPFORGE_HREF } from "@/lib/affiliate-onboarding-shared"
import { redirect } from "next/navigation"

export const dynamic = "force-dynamic"

type Props = {
  searchParams: Promise<{
    aeUrl?: string
    relayKey?: string
    sessionId?: string
    captureToken?: string
  }>
}

export default async function DropForgeAeRelayPage({ searchParams }: Props) {
  const sp = await searchParams
  const aeUrl = sp.aeUrl?.trim() ?? ""
  const validated = validateDropForgeProductUrl(aeUrl)
  if (!validated.ok || !validated.url.includes("aliexpress")) {
    redirect(DROPFORGE_HREF)
  }

  const relayKey = sp.relayKey?.trim() || `df_${Date.now().toString(36)}`
  const sessionId = sp.sessionId?.trim() || (await createAeCaptureSession(relayKey))
  const captureToken = sp.captureToken?.trim() || createAeCaptureToken(sessionId, relayKey)
  const appOrigin =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ?? "https://affisell.com"

  return (
    <DropForgeAeRelayClient
      relayKey={relayKey}
      sessionId={sessionId}
      captureToken={captureToken}
      aeUrl={validated.url}
      appOrigin={appOrigin}
    />
  )
}
