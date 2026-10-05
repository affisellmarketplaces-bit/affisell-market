import Image, { type ImageProps } from "next/image"
import { forwardRef } from "react"

import { canOptimizeImageSrc } from "@/lib/image-remote-hosts"

/**
 * Drop-in for `next/image`. The stock component THROWS during render when `src` is on a host missing from
 * `images.remotePatterns`, which takes the whole page section down for a single product image (imported products keep
 * their source marketplace's CDN URL, so a new import source means a new host). This one renders such an image
 * unoptimized — loaded straight from its origin — and leaves every optimizable image exactly as `next/image` handles it.
 *
 * Protocol-relative URLs (`//ae01.alicdn.com/…`, common in marketplace payloads) are made absolute, which `next/image`
 * rejects in development. An explicit `unoptimized` or custom `loader` from the caller always wins.
 */
export const SafeImage = forwardRef<HTMLImageElement, ImageProps>(function SafeImage(props, ref) {
  const { src: rawSrc, alt, unoptimized, loader, ...rest } = props
  const src = typeof rawSrc === "string" && rawSrc.startsWith("//") ? `https:${rawSrc}` : rawSrc
  const bypassOptimizer = !unoptimized && !loader && typeof src === "string" && !canOptimizeImageSrc(src)

  return <Image ref={ref} {...rest} alt={alt} src={src} loader={loader} unoptimized={unoptimized || bypassOptimizer} />
})

export default SafeImage
