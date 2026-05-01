"use client"

import { FormEvent, useState } from "react"
import { signIn } from "next-auth/react"
import { useTranslations } from "next-intl"

import { Link, useRouter } from "@/i18n/navigation"

export default function LoginPage() {
  const router = useRouter()
  const t = useTranslations("auth")

  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setLoading(true)
    const res = await signIn("credentials", { email, password, redirect: false })
    setLoading(false)
    if (res?.ok) router.push("/dashboard")
    else setError(t("invalidCredentials"))
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md items-center px-6 py-10">
      <form onSubmit={onSubmit} className="w-full space-y-4 rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <h1 className="text-2xl font-semibold">{t("signin")}</h1>
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
        <button
          disabled={loading}
          className="w-full rounded-md bg-black px-4 py-2 text-white disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900"
        >
          {loading ? t("connecting") : t("signin")}
        </button>
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          {t("noAccount")}{" "}
          <Link href="/signup" className="underline">
            {t("signup")}
          </Link>
        </p>
      </form>
    </main>
  )
}
