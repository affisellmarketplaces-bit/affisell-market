import { NextResponse } from "next/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET() {
  const base = (process.env.NEXT_PUBLIC_APP_URL?.trim() || "https://affisell.com").replace(/\/$/, "")
  return NextResponse.json({
    name: "Affisell",
    description: "Affisell marketplace",
    url: `${base}/`,
    namespaces: ["wc/v3"],
    authentication: {
      "wc/v3": ["basic", "query_string"],
    },
    routes: {
      "/wc/v3": { namespace: "wc/v3", methods: ["GET"] },
    },
  })
}
