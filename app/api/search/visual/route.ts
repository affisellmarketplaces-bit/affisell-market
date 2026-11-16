import { NextResponse } from "next/server"

export const runtime = "nodejs"

/**
 * Visual search ("find products that look like this photo") is NOT available: Affisell has no image-similarity engine
 * (no image embeddings are computed or stored). This route used to answer with 12 listings picked by a shuffle seeded
 * on the uploaded bytes and a FABRICATED "% match" (95 % → 72 %, commented "demo scores, no real embeddings yet") —
 * a made-up score presented as a measurement (finalisation master doc, lot I). It now says so, without reading the
 * upload. No page of the app calls it (`components/visual-search-modal.tsx` is rendered nowhere); it stays as an
 * explicit "not available" so that a future caller cannot mistake it for a working feature.
 */
export async function POST() {
  return NextResponse.json(
    {
      error: "visual_search_unavailable",
      message: "La recherche par image n'est pas disponible : aucun moteur de similarité visuelle n'est en service.",
    },
    { status: 501 }
  )
}
