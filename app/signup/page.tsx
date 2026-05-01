"use client"

import { FormEvent, useEffect, useState } from "react"
import { signIn } from "next-auth/react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"

export default function SignupPage() {
  const router = useRouter()
  const search = useSearchParams()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [role, setRole] = useState<"SUPPLIER" | "AFFILIATE">("AFFILIATE")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const r = search.get("role")
    if (r === "SUPPLIER") setRole("SUPPLIER")
    else if (r === "AFFILIATE") setRole("AFFILIATE")
  }, [search])

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const res = await fetch("/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, role }),
    })
    const data = (await res.json()) as { error?: string }
    if (!res.ok) {
      setLoading(false)
      setError(data.error ?? "Signup failed")
      return
    }
    const login = await signIn("credentials", {
      email,
      password,
      redirect: false,
      callbackUrl: role === "SUPPLIER" ? "/dashboard/supplier" : "/dashboard/affiliate",
    })
    setLoading(false)
    if (login?.error) setError("Account created — try signing in.")
    else router.push("/dashboard")
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md items-center px-6">
      <form onSubmit={onSubmit} className="w-full rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <h1 className="text-xl font-semibold">Create account</h1>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
          className="mt-4 w-full rounded-md border px-3 py-2 dark:border-zinc-700 dark:bg-zinc-950"
        />
        <input
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          className="mt-3 w-full rounded-md border px-3 py-2 dark:border-zinc-700 dark:bg-zinc-950"
        />
        <select
          value={role}
          onChange={(e) => setRole(e.target.value as "SUPPLIER" | "AFFILIATE")}
          className="mt-3 w-full rounded-md border px-3 py-2 dark:border-zinc-700 dark:bg-zinc-950"
        >
          <option value="AFFILIATE">Affiliate</option>
          <option value="SUPPLIER">Supplier</option>
        </select>
        <button
          disabled={loading}
          className="mt-4 w-full rounded-md bg-zinc-900 py-2 text-sm font-medium text-white disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900"
        >
          {loading ? "…" : "Create account"}
        </button>
        {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
        <p className="mt-4 text-sm">
          <Link href="/login" className="underline">
            Sign in
          </Link>
        </p>
      </form>
    </main>
  )
}
