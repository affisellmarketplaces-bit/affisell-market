import { pickHomeLcpImageUrls } from "@/lib/home-lcp-images"

type Props = {
  products: unknown[]
}

/** Hoisted `<link rel="preload">` for first catalog images — faster mobile LCP. */
export function HomeCatalogLcpPreload({ products }: Props) {
  const urls = pickHomeLcpImageUrls(products, 4)
  if (urls.length === 0) return null

  return (
    <>
      {urls.map((href) => (
        <link key={href} rel="preload" as="image" href={href} fetchPriority="high" />
      ))}
    </>
  )
}
