/**
 * Full-bleed soft mesh behind buyer home hero + glass PublicNav.
 * Sampled from /public/mockup.png (lavender → violet → sky).
 */
export function BuyerHomeMeshCanvas({ className }: { className?: string }) {
  return (
    <div
      className={className}
      aria-hidden
      data-testid="buyer-home-mesh-canvas"
    >
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(165deg, #F5F3FF 0%, #EDE9FE 28%, #DDD6FE 52%, #C7D2FE 78%, #E0F2FE 100%)",
        }}
      />
      <div
        className="absolute -left-[12%] -top-[18%] h-[28rem] w-[28rem] rounded-full blur-3xl motion-safe:animate-[pulse_9s_ease-in-out_infinite]"
        style={{ backgroundColor: "rgba(167, 139, 250, 0.55)" }}
      />
      <div
        className="absolute -right-[10%] top-[8%] h-[26rem] w-[26rem] rounded-full blur-3xl motion-safe:animate-[pulse_11s_ease-in-out_infinite]"
        style={{ backgroundColor: "rgba(125, 211, 252, 0.42)" }}
      />
      <div
        className="absolute left-1/2 top-[22%] h-64 w-[min(92%,40rem)] -translate-x-1/2 rounded-full blur-3xl"
        style={{ backgroundColor: "rgba(196, 181, 253, 0.45)" }}
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
