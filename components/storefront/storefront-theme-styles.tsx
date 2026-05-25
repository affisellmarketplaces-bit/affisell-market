import type { StorefrontTheme } from "@/lib/storefront-theme-shared"
import { themeToCssVars } from "@/lib/storefront-theme-shared"

type Props = {
  theme: StorefrontTheme
}

/** Injects CSS variables for branded public storefronts. */
export function StorefrontThemeStyles({ theme }: Props) {
  const vars = themeToCssVars(theme)
  const css = `:root{${Object.entries(vars)
    .map(([k, v]) => `${k}:${v}`)
    .join(";")}}`
  return <style dangerouslySetInnerHTML={{ __html: css }} />
}
