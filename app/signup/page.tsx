"use client"

import type { FormEvent } from "react"
import { useEffect, useState } from "react"
import { signIn } from "next-auth/react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"

type AccountType = "AFFILIATE" | "SUPPLIER"

export default function SignupPage() {
  const router = useRouter()
  const search = useSearchParams()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [accountType, setAccountType] = useState<AccountType>("AFFILIATE")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const r = search.get("role")
    if (r === "SUPPLIER") setAccountType("SUPPLIER")
    else if (r === "AFFILIATE") setAccountType("AFFILIATE")
  }, [search])

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const res = await fetch("/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, role: accountType }),
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
      callbackUrl: accountType === "SUPPLIER" ? "/dashboard/supplier" : "/dashboard/affiliate",
    })
    setLoading(false)
    if (login?.error) setError("Account created — try signing in.")
    else router.push("/dashboard")
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-8">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-gray-900">Affisell</h1>
          <p className="mt-2 text-gray-600">Create your seller or affiliate account</p>
        </div>

        <div className="rounded-2xl bg-white p-8 shadow-sm">
          <form onSubmit={onSubmit} className="space-y-5">
            <div className="mb-6">
              <label className="mb-3 block text-sm font-medium text-gray-700">I want to</label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setAccountType("AFFILIATE")}
                  className={`rounded-xl border-2 p-4 text-left transition-all ${
                    accountType === "AFFILIATE"
                      ? "border-blue-600 bg-blue-50"
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                >
                  <div className="mb-1 text-2xl">💼</div>
                  <div className="font-medium text-gray-900">Join as Affiliate</div>
                  <div className="mt-1 text-xs text-gray-500">Promote & earn commissions</div>
                </button>

                <button
                  type="button"
                  onClick={() => setAccountType("SUPPLIER")}
                  className={`rounded-xl border-2 p-4 text-left transition-all ${
                    accountType === "SUPPLIER"
                      ? "border-blue-600 bg-blue-50"
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                >
                  <div className="mb-1 text-2xl">📦</div>
                  <div className="font-medium text-gray-900">Join as Supplier</div>
                  <div className="mt-1 text-xs text-gray-500">Sell your products</div>
                </button>
              </div>
              <input type="hidden" name="accountType" value={accountType} />
            </div>

            <div>
              <label htmlFor="signup-email" className="mb-1.5 block text-sm font-medium text-gray-700">
                Email
              </label>
              <input
                id="signup-email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full rounded-xl border border-gray-300 px-4 py-2.5 outline-none transition focus:border-transparent focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label htmlFor="signup-password" className="mb-1.5 block text-sm font-medium text-gray-700">
                Password
              </label>
              <input
                id="signup-password"
                type="password"
                required
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded-xl border border-gray-300 px-4 py-2.5 outline-none transition focus:border-transparent focus:ring-2 focus:ring-blue-500"
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

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-200" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="bg-white px-3 text-gray-500">Already have an account?</span>
            </div>
          </div>

          <p className="text-center text-sm text-gray-600">
            <Link href="/login" className="font-medium text-blue-600 hover:text-blue-700">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
