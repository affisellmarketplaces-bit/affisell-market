"use client"

import { FormEvent, useEffect, useState } from "react"
import { signIn } from "next-auth/react"
import { useTranslations } from "next-intl"
import { useSearchParams } from "next/navigation"

import { Link, useRouter } from "@/i18n/navigation"

export default function SignupPage() {
  const router = useRouter()
  const search = useSearchParams()
  const t = useTranslations("auth")

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

    const text = await res.text()
    const data = text ? (JSON.parse(text) as { error?: string }) : {}
    if (!res.ok) {
      setLoading(false)
      setError(data.error || t("signupFail"))
      return
    }

    const login = await signIn("credentials", {
      email,
      password,
      redirect: false,
      callbackUrl: role === "SUPPLIER" ? "/dashboard/supplier" : "/dashboard/affiliate",
    })

    setLoading(false)
    if (login?.error) {
      setError(t("signupLoginFail"))
      return
    }

    router.push((login?.url as string | undefined) || "/dashboard")
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md items-center px-6 py-10">
      <form onSubmit={onSubmit} className="w-full space-y-4 rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <h1 className="text-2xl font-semibold">{t("signupTitle")}</h1>
        <input
          type="email"
          required
          placeholder={t("email")}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-950"
        />
        <input
          type="password"
          required
          placeholder={t("password")}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-950"
        />
        <select
          value={role}
          aria-label={t("roleHint")}
          onChange={(e) => setRole(e.target.value as "SUPPLIER" | "AFFILIATE")}
          className="w-full rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-950"
        >
          <option value="SUPPLIER">{t("roleSupplier")}</option>
          <option value="AFFILIATE">{t("roleAffiliate")}</option>
        </select>
        <button
          disabled={loading}
          className="w-full rounded-md bg-black px-4 py-2 text-white disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900"
        >
          {loading ? t("creating") : t("signup")}
        </button>
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          {t("hasAccount")}{" "}
          <Link href="/login" className="underline">
            {t("signin")}
          </Link>
        </p>
      </form>
    </main>
  )
}
