/** `/public` root files — must bypass i18n/auth proxy rewrites. */
export function isPublicStaticAssetPath(pathname: string): boolean {
  const path = pathname.split("?")[0]?.split("#")[0] ?? ""
  if (!path || path === "/") return false
  return /\.(?:webp|avif|png|jpe?g|gif|svg|ico|woff2?|ttf|eot|mp4|webm|txt|xml|json|map|pdf)$/i.test(
    path
  )
}
