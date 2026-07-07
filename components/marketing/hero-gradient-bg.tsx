export function HeroGradientBg() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_-10%,rgba(255,255,255,0.18),transparent)]" />
      <div className="affisell-hero-orb affisell-hero-orb--violet absolute -left-1/4 top-0 h-full w-[55%] rounded-full max-md:w-[45%]" />
      <div className="affisell-hero-orb affisell-hero-orb--sky absolute -right-1/4 top-1/4 h-[80%] w-[50%] rounded-full max-md:w-[40%]" />
      <div
        className="absolute inset-0 opacity-[0.35] mix-blend-overlay"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.5'/%3E%3C/svg%3E")`,
        }}
      />
    </div>
  )
}
