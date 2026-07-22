import { ImageResponse } from "next/og"

import { BubbleAssetLayout } from "@/components/social/templates/BubbleSocialTemplates"
import { loadBubbleProductView } from "@/lib/social/load-bubble-product.server"

export const runtime = "nodejs"
export const alt = "Affisell · Fiche produit bulle"
export const size = { width: 1200, height: 630 }
export const contentType = "image/png"

type Props = { params: Promise<{ id: string }> }

export default async function BubbleOpenGraphImage({ params }: Props) {
  const { id } = await params
  const product = await loadBubbleProductView(id)

  if (!product) {
    return new ImageResponse(
      (
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "#312e81",
            color: "white",
            fontSize: 48,
            fontWeight: 700,
          }}
        >
          Affisell 🫧
        </div>
      ),
      size
    )
  }

  return new ImageResponse(
    (
      <BubbleAssetLayout
        product={product}
        width={1200}
        height={630}
        template="bubble-og"
        hook={`${product.salePrice.toFixed(0)}€ · +${product.marginEuro.toFixed(0)}€ marge`}
      />
    ),
    size
  )
}
