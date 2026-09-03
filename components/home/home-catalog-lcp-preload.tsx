import { pickHomeLcpImageUrls } from "@/lib/home-lcp-images"

type Props = {
  products: unknown[]
}

/** Hoisted `<link rel="preload">` for the LCP catalog image (+ one sibling). */
export function HomeCatalogLcpPreload({ products }: Props) {
  const urls = pickHomeLcpImageUrls(products, 2)
  if (urls.length === 0) return null

  const [primary, secondary] = urls

  return (
    <>
      <link rel="preload" as="image" href={primary} fetchPriority="high" />
      {secondary ? (
        <link rel="preload" as="image" href={secondary} fetchPriority="low" />
      ) : null}
    </>
  )
}
