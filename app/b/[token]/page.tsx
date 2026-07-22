import { redirect } from "next/navigation"

import { prisma } from "@/lib/prisma"

type Props = { params: Promise<{ token: string }> }

export default async function BubbleShortLinkPage({ params }: Props) {
  const { token } = await params
  if (!token?.trim()) {
    redirect("/marketplace")
  }

  const link = await prisma.bubbleLink.findUnique({
    where: { token },
    select: { productId: true, id: true },
  })

  if (!link) {
    redirect("/marketplace")
  }

  await prisma.bubbleLink.update({
    where: { id: link.id },
    data: { clicks: { increment: 1 } },
  })

  console.log("[bubble-link-click]", { token, productId: link.productId })

  redirect(
    `/product/${encodeURIComponent(link.productId)}/bubble?utm_source=share&utm_medium=bubble&utm_campaign=b`
  )
}
