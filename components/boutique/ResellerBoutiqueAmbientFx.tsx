"use client"

/** Ambient mesh + floating orbs for reseller boutique wow effect. */
export function ResellerBoutiqueAmbientFx() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      <div className="boutique-mesh-shift absolute -inset-[40%] opacity-60" />
      <div
        className="boutique-float absolute left-[8%] top-[18%] h-40 w-40 rounded-full blur-3xl"
        style={{ backgroundColor: "var(--boutique-glow-primary)" }}
      />
      <div
        className="boutique-float-delayed absolute right-[10%] top-[32%] h-52 w-52 rounded-full blur-3xl"
        style={{ backgroundColor: "var(--boutique-glow-accent)" }}
      />
      <div
        className="boutique-float absolute bottom-[12%] left-[35%] h-32 w-32 rounded-full blur-2xl opacity-70"
        style={{ backgroundColor: "var(--boutique-glow-accent)" }}
      />
    </div>
  )
}
