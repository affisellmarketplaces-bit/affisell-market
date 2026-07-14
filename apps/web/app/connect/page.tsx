export default function ConnectPage() {
  const apiUrl = process.env.NEXT_PUBLIC_MI_API_URL || "http://localhost:3002"
  const connectUrl = `${apiUrl.replace(/\/$/, "")}/auth/tiktok/start`

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold tracking-tight">Connect TikTok Shop</h2>
      <p className="text-sm text-zinc-300">
        Démarre le flow OAuth via l’API NestJS. Le callback TikTok doit être configuré sur{" "}
        <span className="font-mono">https://verify.affisell.com/auth/tiktok/callback</span>.
      </p>

      <a
        className="inline-flex items-center rounded-lg bg-white px-4 py-2 text-sm font-medium text-zinc-950"
        href={connectUrl}
      >
        Connect with TikTok
      </a>

      <p className="text-xs text-zinc-500">
        NEXT_PUBLIC_MI_API_URL: <span className="font-mono">{apiUrl}</span>
      </p>
    </div>
  )
}

