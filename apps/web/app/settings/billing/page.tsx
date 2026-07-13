export default function BillingPage() {
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold tracking-tight">Billing</h2>
      <p className="text-sm text-zinc-300">
        Stripe checkout pour les plans 49€ / 199€ / 299€ par mois.
      </p>
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-5 text-xs text-zinc-500">
        Placeholder V1 — sera rempli via UserModule + Subscription.
      </div>
    </div>
  )
}

