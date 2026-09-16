/**
 * Full-bleed aurora mesh behind buyer home hero + glass PublicNav.
 * Deep indigo/violet/cyan aurora, radiating out from a soft center
 * spotlight so the dark hero title (#0f172a) and white search pill
 * stay legible without flattening the color into a pale wash.
 */
export function BuyerHomeMeshCanvas({ className }: { className?: string }) {
  return (
    <div
      className={className}
      aria-hidden
      data-testid="buyer-home-mesh-canvas"
    >
      {/* Base wash — light top-center, deepens toward the edges */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(120% 85% at 50% 0%, #F8F7FF 0%, #E9E4FC 20%, #D3C7F8 38%, #AE95EF 58%, #8B72E0 76%, #6857CC 100%)",
        }}
      />

      {/* Aurora blobs — indigo, violet-fuchsia, cyan accent */}
      <div
        className="absolute -left-[14%] -top-[20%] h-[30rem] w-[30rem] rounded-full blur-[90px] motion-safe:animate-[pulse_9s_ease-in-out_infinite]"
        style={{ backgroundColor: "rgba(79, 70, 229, 0.62)" }}
      />
      <div
        className="absolute -right-[12%] top-[2%] h-[28rem] w-[28rem] rounded-full blur-[90px] motion-safe:animate-[pulse_12s_ease-in-out_infinite]"
        style={{ backgroundColor: "rgba(192, 38, 211, 0.4)" }}
      />
      <div
        className="absolute right-[8%] bottom-[8%] h-[20rem] w-[20rem] rounded-full blur-[80px] motion-safe:animate-[pulse_14s_ease-in-out_infinite]"
        style={{ backgroundColor: "rgba(34, 211, 238, 0.38)" }}
      />

      {/* Center spotlight — keeps title + search legible over the richer aurora */}
      <div
        className="absolute left-1/2 top-[4%] h-[26rem] w-[min(94%,46rem)] -translate-x-1/2 rounded-full blur-3xl"
        style={{ backgroundColor: "rgba(255, 255, 255, 0.62)" }}
      />

      {/* Grain — subtle tactile finish, premium over flat gradient */}
      <div
        className="absolute inset-0 opacity-[0.05] mix-blend-overlay"
        aria-hidden
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
        }}
      />

      <div
        className="absolute inset-x-0 bottom-0 h-40"
        style={{
          background:
            "linear-gradient(180deg, transparent 0%, rgba(255,255,255,0.55) 55%, #ffffff 100%)",
        }}
      />
    </div>
  )
}
