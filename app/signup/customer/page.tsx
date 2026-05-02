"use client"

import type { FormEvent } from "react"
import { useState } from "react"
import { signIn } from "next-auth/react"
import Link from "next/link"
import { useRouter } from "next/navigation"

export default function CustomerSignupPage() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const res = await fetch("/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, role: "CUSTOMER" }),
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
      callbackUrl: "/marketplace",
    })
    setLoading(false)
    if (login?.error) setError("Account created — try signing in.")
    else router.push("/dashboard")
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-gray-900">Shop & Get Paid Back</h1>
          <p className="mt-2 text-gray-600">Get cashback and bonuses on every purchase</p>
        </div>

        <div className="rounded-2xl bg-white p-8 shadow-sm">
          <form onSubmit={onSubmit} className="space-y-5">
            <div>
              <label htmlFor="customer-email" className="mb-1.5 block text-sm font-medium text-gray-700">
                Email
              </label>
              <input
                id="customer-email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full rounded-xl border border-gray-300 px-4 py-2.5 outline-none transition focus:border-transparent focus:ring-2 focus:ring-blue-600"
              />
            </div>
            <div>
              <label htmlFor="customer-password" className="mb-1.5 block text-sm font-medium text-gray-700">
                Password
              </label>
              <input
                id="customer-password"
                type="password"
                required
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded-xl border border-gray-300 px-4 py-2.5 outline-none transition focus:border-transparent focus:ring-2 focus:ring-blue-600"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-blue-600 py-2.5 font-medium text-white shadow-sm transition-colors hover:bg-blue-700 disabled:opacity-60"
            >
              {loading ? "Creating account…" : "Create account"}
            </button>
            {error ? <p className="text-center text-sm text-red-600">{error}</p> : null}
          </form>

          <div className="mt-6 border-t border-gray-100 pt-6">
            <div className="space-y-2.5 text-sm text-gray-600">
              <div className="flex items-center gap-2">
                <span className="text-green-600">✓</span> 5% cashback credited instantly
              </div>
              <div className="flex items-center gap-2">
                <span className="text-green-600">✓</span> Bonus credits for reviews & referrals
              </div>
              <div className="flex items-center gap-2">
                <span className="text-green-600">✓</span> Support creators you love
              </div>
            </div>
          </div>
        </div>

        <p className="mt-6 text-center text-sm text-gray-600">
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-blue-600 hover:text-blue-700">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  )
}
