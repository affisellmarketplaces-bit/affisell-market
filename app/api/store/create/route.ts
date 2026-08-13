import { NextResponse } from "next/server"
export async function POST(req: Request) {
  const { storeName } = await req.json()
  const slug = storeName.toLowerCase().trim().replace(/[^a-z0-9]+/g,'-')
  return NextResponse.json({ success: true, url: `/boutique/${slug}`, slug })
}
