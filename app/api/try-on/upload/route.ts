import { NextResponse } from "next/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * Retired. This endpoint took an anonymous multipart upload, re-encoded it and published it on the PUBLIC blob store —
 * with no authentication, no rate limit, and (through `?tryon=1`) even while the try-on kill switch was off. Nothing in
 * the app called it: the storefront sends the shopper's photo to `POST /api/try-on`, which stores it privately-ish,
 * rate limits it and deletes it after the job. Answering 410 (not 404) tells any unknown caller that it is gone on
 * purpose.
 */
export async function POST() {
  console.log("[try-on]", { result: "upload_endpoint_retired" })
  return NextResponse.json(
    { error: "This endpoint has been retired. Use POST /api/try-on." },
    { status: 410 }
  )
}
