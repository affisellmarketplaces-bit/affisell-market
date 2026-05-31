import { redirect } from "next/navigation"

import { AeImportRelayClient } from "@/components/admin/ae-import-relay-client"
import { auth } from "@/auth"
import { createAeCaptureSession } from "@/lib/fulfillment/ae-capture-session"
import { createAeCaptureToken } from "@/lib/fulfillment/ae-capture-token"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

type Props = {
  params: Promise<{ id: string }>
  searchParams: Promise<{ aeUrl?: string; sessionId?: string; captureToken?: string }>
}

export default async function AeImportRelayPage({ params, searchParams }: Props) {
  const { id: productId } = await params
  const sp = await searchParams
  const session = await auth()
  if (!session?.user?.id || (session.user as { role?: string }).role !== "ADMIN") {
    redirect(`/login/admin?callbackUrl=/admin/products/${productId}`)
  }

  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: { id: true },
  })
  if (!product) redirect("/admin/auto-fulfill")

  const aeUrl = sp.aeUrl?.trim() ?? ""
  if (!aeUrl.includes("aliexpress")) redirect(`/admin/products/${productId}`)

  const sessionId = sp.sessionId?.trim() || (await createAeCaptureSession(productId))
  const captureToken =
    sp.captureToken?.trim() || createAeCaptureToken(sessionId, productId)
  const appOrigin =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ?? "https://affisell.com"

  return (
    <AeImportRelayClient
      productId={productId}
      sessionId={sessionId}
      captureToken={captureToken}
      aeUrl={aeUrl}
      appOrigin={appOrigin}
    />
  )
}
