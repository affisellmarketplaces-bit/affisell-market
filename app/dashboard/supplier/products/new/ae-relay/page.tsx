import { randomBytes } from "node:crypto"
import { redirect } from "next/navigation"

import { WizardV2AeRelayClient } from "@/components/supplier/wizard-v2/wizard-v2-ae-relay-client"
import { auth } from "@/auth"
import { createAeCaptureSession } from "@/lib/fulfillment/ae-capture-session"
import { createAeCaptureToken } from "@/lib/fulfillment/ae-capture-token"

export const dynamic = "force-dynamic"

type Props = {
  searchParams: Promise<{
    aeUrl?: string
    relayKey?: string
    sessionId?: string
    captureToken?: string
  }>
}

export default async function WizardV2AeRelayPage({ searchParams }: Props) {
  const sp = await searchParams
  const session = await auth()
  if (!session?.user?.id) {
    redirect("/login?callbackUrl=/dashboard/supplier/products/new?wizard=v2&mode=express")
  }
  const role = (session.user as { role?: string }).role
  if (role !== "SUPPLIER" && role !== "ADMIN") {
    redirect("/dashboard")
  }

  const aeUrl = sp.aeUrl?.trim() ?? ""
  if (!aeUrl.includes("aliexpress")) {
    redirect("/dashboard/supplier/products/new?wizard=v2&mode=express")
  }

  const relayKey =
    sp.relayKey?.trim() || `wzv2_${session.user.id.slice(-8)}_${randomBytes(4).toString("hex")}`
  const sessionId = sp.sessionId?.trim() || (await createAeCaptureSession(relayKey))
  const captureToken = sp.captureToken?.trim() || createAeCaptureToken(sessionId, relayKey)
  const appOrigin =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ?? "https://affisell.com"

  return (
    <WizardV2AeRelayClient
      relayKey={relayKey}
      sessionId={sessionId}
      captureToken={captureToken}
      aeUrl={aeUrl}
      appOrigin={appOrigin}
    />
  )
}
