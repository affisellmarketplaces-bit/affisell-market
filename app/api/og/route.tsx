import { ImageResponse } from "next/og"
import type { NextRequest } from "next/server"

export const runtime = "edge"

export async function GET(request: NextRequest) {
  const title = request.nextUrl.searchParams.get("title") ?? "Affisell Market"
  const subtitle = request.nextUrl.searchParams.get("subtitle") ?? "Creator storefront marketplace"

  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #6366F1 0%, #312e81 100%)",
          color: "white",
          padding: 48,
        }}
      >
        <div style={{ fontSize: 56, fontWeight: 700 }}>{title}</div>
        <div style={{ fontSize: 28, marginTop: 16, opacity: 0.9 }}>{subtitle}</div>
      </div>
    ),
    { width: 1200, height: 630 }
  )
}
