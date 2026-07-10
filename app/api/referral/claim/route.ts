import { put } from "@vercel/blob"
import { NextResponse } from "next/server"

import { auth } from "@/auth"
import { rateLimitClientKey, rateLimitResponse } from "@/lib/api-rate-limit"
import { prisma } from "@/lib/prisma"
import { UGC_BOUNTY_CENTS } from "@/lib/referral-shared"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 60

const MAX_SCREENSHOT_BYTES = 5 * 1024 * 1024
const TWEET_HOSTS = ["twitter.com", "x.com", "mobile.twitter.com"]

function isValidTweetUrl(raw: string): boolean {
  try {
    const url = new URL(raw.trim())
    if (url.protocol !== "https:" && url.protocol !== "http:") return false
    const host = url.hostname.replace(/^www\./, "")
    return TWEET_HOSTS.some((h) => host === h || host.endsWith(`.${h}`))
  } catch {
    return false
  }
}

async function uploadScreenshot(userId: string, file: File): Promise<string | null> {
  if (!file.type.startsWith("image/")) return null
  if (file.size > MAX_SCREENSHOT_BYTES) return null

  const bytes = Buffer.from(await file.arrayBuffer())
  const ext = file.type.includes("png") ? "png" : file.type.includes("webp") ? "webp" : "jpg"
  const key = `referral-ugc/${userId}/${Date.now()}.${ext}`

  try {
    const blob = await put(key, bytes, {
      access: "public",
      contentType: file.type || `image/${ext}`,
      addRandomSuffix: true,
    })
    return blob.url
  } catch (error) {
    console.log("[referral-claim]", {
      userId,
      result: "upload_failed",
      error: error instanceof Error ? error.message : String(error),
    })
    return null
  }
}

export async function POST(req: Request) {
  const limited = rateLimitResponse(rateLimitClientKey(req), {
    prefix: "referral-claim",
    limit: 6,
    windowMs: 60 * 60 * 1000,
  })
  if (limited) return limited

  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }
  if (session.user.role !== "AFFILIATE") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 })
  }

  const userId = session.user.id

  let tweetUrl = ""
  let screenshotUrl = ""

  const contentType = req.headers.get("content-type") || ""
  if (contentType.includes("multipart/form-data")) {
    const form = await req.formData()
    tweetUrl = String(form.get("tweetUrl") ?? "").trim()
    const screenshot = form.get("screenshot")
    if (screenshot instanceof File && screenshot.size > 0) {
      const uploaded = await uploadScreenshot(userId, screenshot)
      if (!uploaded) {
        return NextResponse.json({ error: "invalid_screenshot" }, { status: 400 })
      }
      screenshotUrl = uploaded
    }
  } else {
    const body = (await req.json()) as { tweetUrl?: string; screenshotUrl?: string }
    tweetUrl = typeof body.tweetUrl === "string" ? body.tweetUrl.trim() : ""
    screenshotUrl = typeof body.screenshotUrl === "string" ? body.screenshotUrl.trim() : ""
  }

  if (!isValidTweetUrl(tweetUrl)) {
    return NextResponse.json({ error: "invalid_tweet_url" }, { status: 400 })
  }
  if (!screenshotUrl) {
    return NextResponse.json({ error: "screenshot_required" }, { status: 400 })
  }

  const pending = await prisma.referralUgcClaim.findFirst({
    where: { userId, status: "pending" },
    select: { id: true },
  })
  if (pending) {
    return NextResponse.json({ error: "claim_already_pending" }, { status: 409 })
  }

  const approved = await prisma.referralUgcClaim.findFirst({
    where: { userId, status: "approved" },
    select: { id: true },
  })
  if (approved) {
    return NextResponse.json({ error: "bounty_already_claimed" }, { status: 409 })
  }

  const claim = await prisma.referralUgcClaim.create({
    data: {
      userId,
      tweetUrl,
      screenshotUrl,
      bonusCents: UGC_BOUNTY_CENTS,
      status: "pending",
    },
  })

  console.log("[referral-claim]", { userId, claimId: claim.id, result: "submitted" })

  return NextResponse.json({
    ok: true,
    claimId: claim.id,
    status: "pending",
    bonusCents: UGC_BOUNTY_CENTS,
  })
}
