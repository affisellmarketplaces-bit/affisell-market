import { get1688 } from "@/lib/onebound"

/** POST { url } → { ok:true, product } | { ok:false, error } */
export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST")
    return res.status(405).json({ ok: false, error: "Method not allowed" })
  }

  const url = typeof req.body?.url === "string" ? req.body.url.trim() : ""
  if (!url) {
    return res.status(400).json({ ok: false, error: "url manquante" })
  }

  try {
    const product = await get1688(url)

    // TODO: persister en base (idempotent sur product.source) :
    // await db.product.create({ data: { ...product, supplierId } })

    console.log("[import-1688]", {
      source: product.source,
      name: product.name.slice(0, 60),
      variants: product.variants.length,
      result: "fetched",
    })

    return res.status(200).json({ ok: true, product })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Import 1688 échoué"
    console.error("[import-1688]", { url: url.slice(0, 120), result: "error", message })
    return res.status(502).json({ ok: false, error: message })
  }
}
