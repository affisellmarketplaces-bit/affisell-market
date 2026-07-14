"use client"

export default function ConnectPage() {
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold tracking-tight">Connect TikTok Shop</h2>
      <p className="text-sm text-zinc-300">
        Démarre le flow OAuth via le proxy Next.js (token Clerk côté serveur). Le callback TikTok
        doit être configuré sur{" "}
        <span className="font-mono">https://verify.affisell.com/auth/tiktok/callback</span>.
      </p>

      <button
        type="button"
        className="inline-flex items-center rounded-lg bg-white px-4 py-2 text-sm font-medium text-zinc-950"
        onClick={() => {
          window.location.href = "/api/tiktok/start"
        }}
      >
        Connect TikTok Shop
      </button>

      <p className="text-xs text-zinc-500">
        Connecte-toi d&apos;abord via <span className="font-mono">/sign-in</span> si tu n&apos;as
        pas de session Clerk.
      </p>
    </div>
  )
}
