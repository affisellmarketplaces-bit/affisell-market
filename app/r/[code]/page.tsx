import { cookies } from "next/headers"
import { redirect } from "next/navigation"

import { REFERRAL_COOKIE_NAME } from "@/lib/referral-shared"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

type PageProps = { params: Promise<{ code: string }> }

export default async function ReferralLandingPage({ params }: PageProps) {
  const { code } = await params
  const trimmed = code.trim()
  if (!trimmed) redirect("/signup/affiliate")

  const referrer = await prisma.user.findUnique({
    where: { referralCode: trimmed },
    select: { id: true, role: true },
  })

  if (referrer?.role === "AFFILIATE") {
    const jar = await cookies()
    jar.set(REFERRAL_COOKIE_NAME, trimmed, {
      maxAge: 60 * 60 * 24 * 30,
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    })
    console.log("[referral]", { code: trimmed, referrerId: referrer.id, result: "cookie_set" })
  }

  redirect("/signup/affiliate")
}
