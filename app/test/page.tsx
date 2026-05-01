import { TestPayButton } from "./test-pay-button"

export default function TestPage() {
  return (
    <main className="mx-auto max-w-md p-8">
      <h1 className="text-xl font-semibold tracking-tight">Paiement test</h1>
      <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
        Tu dois être connecté. Sur Stripe, utilise la carte test{" "}
        <span className="font-mono">4242 4242 4242 4242</span>, une date future
        et un CVC quelconque. Après paiement tu reviens sur tes commandes.
      </p>
      <div className="mt-8">
        <TestPayButton />
      </div>
    </main>
  )
}
