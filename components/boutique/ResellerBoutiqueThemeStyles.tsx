import {
  boutiqueThemeToCssVarRecord,
  resolveResellerBoutiqueThemeCssVars,
  type ResellerBoutiqueThemeProps,
} from "@/lib/boutique/reseller-boutique-theme-shared"

type Props = {
  theme: ResellerBoutiqueThemeProps
}

/** Injects CSS variables for themed reseller boutique pages. */
export function ResellerBoutiqueThemeStyles({ theme }: Props) {
  const vars = resolveResellerBoutiqueThemeCssVars(theme)
  const cssVars = boutiqueThemeToCssVarRecord(vars)
  const css = `:root{${Object.entries(cssVars)
    .map(([k, v]) => `${k}:${v}`)
    .join(";")}}`
  return <style dangerouslySetInnerHTML={{ __html: css }} />
}
