import { NextRequest, NextResponse } from "next/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(req: NextRequest) {
  try {
    const { image, mask } = (await req.json()) as { image?: string; mask?: string }

    if (!process.env.HF_TOKEN) {
      return NextResponse.json({ error: "HF_TOKEN not configured" }, { status: 500 })
    }

    if (!image || !mask) {
      return NextResponse.json({ error: "Missing image or mask" }, { status: 400 })
    }

    // Convert base64 to blob for HF API
    const imageBase64 = image.split(",")[1]
    const maskBase64 = mask.split(",")[1]

    if (!imageBase64 || !maskBase64) {
      return NextResponse.json({ error: "Invalid image or mask (expected data URLs)" }, { status: 400 })
    }

    const response = await fetch("https://api-inference.huggingface.co/models/frank-xwang/lama-cleaner", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.HF_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        inputs: {
          image: imageBase64,
          mask: maskBase64,
        },
      }),
    })

    if (!response.ok) {
      const error = await response.text()
      return NextResponse.json({ error }, { status: response.status })
    }

    const result = await response.arrayBuffer()
    const base64 = Buffer.from(result).toString("base64")
    const dataUrl = `data:image/png;base64,${base64}`

    return NextResponse.json({ image: dataUrl })
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    )
  }
}
