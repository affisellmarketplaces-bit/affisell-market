"use client"

import { FormEvent, useState } from "react"
import { signIn } from "next-auth/react"
import { useRouter } from "next/navigation"

export default function SignupPage() {
  const router = useRouter()

  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [role, setRole] = useState<"FOURNISSEUR" | "AFFILIE">("AFFILIE")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const res = await fetch("/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, role }),
    })

    const text = await res.text()
    const data = text ? JSON.parse(text) : {}
    if (!res.ok) {
      setLoading(false)
      setError(data.error || "Inscription impossible")
      return
    }

    const login = await signIn("credentials", {
      email,
      password,
      redirect: false,
      callbackUrl: role === "FOURNISSEUR" ? "/dashboard/fournisseur" : "/dashboard/affiliate",
    })

    setLoading(false)
    if (login?.error) {
      setError("Compte cree, mais connexion impossible")
      return
    }

    router.push(login?.url || "/dashboard/affiliate")
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md items-center px-6 py-10">
      <form onSubmit={onSubmit} className="w-full space-y-4 rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-semibold">Inscription</h1>
        <input
          type="email"
          required
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-md border border-zinc-300 px-3 py-2"
        />
        <input
          type="password"
          required
          placeholder="Mot de passe"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded-md border border-zinc-300 px-3 py-2"
        />
        <select
          value={role}
          onChange={(e) => setRole(e.target.value as "FOURNISSEUR" | "AFFILIE")}
          className="w-full rounded-md border border-zinc-300 px-3 py-2"
        >
          <option value="FOURNISSEUR">FOURNISSEUR</option>
          <option value="AFFILIE">AFFILIE</option>
        </select>
        <button
          disabled={loading}
          className="w-full rounded-md bg-black px-4 py-2 text-white disabled:opacity-60"
        >
          {loading ? "Creation..." : "Creer mon compte"}
        </button>
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        <p className="text-sm text-zinc-600">
          Deja inscrit ? <a href="/login" className="underline">Se connecter</a>
        </p>
      </form>
    </main>
  )
}
