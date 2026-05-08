import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

export default function proxy(req: NextRequest) {
  // Only run on runtime, not build time
  return NextResponse.next()
}

export const config = {
  matcher: ["/supplier/:path*"],
}
