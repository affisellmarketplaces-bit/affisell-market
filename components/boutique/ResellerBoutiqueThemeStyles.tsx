import {
  boutiqueThemeToCssVarRecord,
  resolveResellerBoutiqueThemeCssVars,
  type ResellerBoutiqueThemeProps,
} from "@/lib/boutique/reseller-boutique-theme-shared"

type Props = {
  theme: ResellerBoutiqueThemeProps
}

const KEYFRAMES = `
@keyframes boutique-mesh-shift {
  0%, 100% { transform: translate(0, 0) rotate(0deg) scale(1); }
  33% { transform: translate(3%, -2%) rotate(2deg) scale(1.04); }
  66% { transform: translate(-2%, 2%) rotate(-1deg) scale(1.02); }
}
@keyframes boutique-float {
  0%, 100% { transform: translateY(0); opacity: 0.85; }
  50% { transform: translateY(-14px); opacity: 1; }
}
@keyframes boutique-float-delayed {
  0%, 100% { transform: translateY(0) translateX(0); opacity: 0.75; }
  50% { transform: translateY(-10px) translateX(6px); opacity: 1; }
}
@keyframes boutique-card-shimmer {
  0% { background-position: 200% center; }
  100% { background-position: -200% center; }
}
.boutique-mesh-shift {
  background: radial-gradient(circle at 20% 20%, var(--boutique-glow-primary) 0%, transparent 45%),
    radial-gradient(circle at 80% 0%, var(--boutique-glow-accent) 0%, transparent 40%),
    radial-gradient(circle at 50% 100%, var(--boutique-glow-primary) 0%, transparent 50%);
  animation: boutique-mesh-shift 18s ease-in-out infinite;
}
.boutique-float { animation: boutique-float 7s ease-in-out infinite; }
.boutique-float-delayed { animation: boutique-float-delayed 9s ease-in-out infinite; }
.boutique-card-wow {
  transition: transform 0.35s ease, box-shadow 0.35s ease;
}
.boutique-card-wow:hover {
  transform: translateY(-4px);
  box-shadow: var(--boutique-button-shadow);
}
`

/** Injects CSS variables + wow animations for themed reseller boutique pages. */
export function ResellerBoutiqueThemeStyles({ theme }: Props) {
  const vars = resolveResellerBoutiqueThemeCssVars(theme)
  const cssVars = boutiqueThemeToCssVarRecord(vars)
  const css = `:root{${Object.entries(cssVars)
    .map(([k, v]) => `${k}:${v}`)
    .join(";")}}\n${KEYFRAMES}`
  return <style dangerouslySetInnerHTML={{ __html: css }} />
}
