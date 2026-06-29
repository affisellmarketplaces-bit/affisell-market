"use client"

import { useState, type FormEvent } from "react"
import { Loader2, Mail, Send } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"

type Props = {
  supportEmail: string
  className?: string
}

export function ContactForm({ supportEmail, className }: Props) {
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [subject, setSubject] = useState("")
  const [message, setMessage] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [ticketRef, setTicketRef] = useState<string | null>(null)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    setSuccess(false)
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, subject, message }),
      })
      const data = (await res.json()) as { ok?: boolean; error?: string; ticketRef?: string }
      if (!res.ok || !data.ok) {
        throw new Error(data.error ?? "Envoi impossible")
      }
      setSuccess(true)
      setTicketRef(data.ticketRef ?? null)
      setName("")
      setEmail("")
      setSubject("")
      setMessage("")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur réseau")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className={cn("relative space-y-6", className)}>
      <div className="flex items-start gap-3 rounded-xl border border-violet-200/80 bg-violet-50/60 p-4 dark:border-violet-900/50 dark:bg-violet-950/30">
        <Mail className="mt-0.5 size-5 shrink-0 text-violet-600 dark:text-violet-400" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-violet-700 dark:text-violet-300">
            Email direct
          </p>
          <a
            href={`mailto:${supportEmail}`}
            className="mt-1 inline-block break-all text-base font-semibold text-violet-800 underline-offset-4 hover:underline dark:text-violet-200"
          >
            {supportEmail}
          </a>
        </div>
      </div>

      <form onSubmit={onSubmit} className="space-y-4">
        <input
          type="text"
          name="website"
          tabIndex={-1}
          autoComplete="off"
          className="pointer-events-none absolute left-[-9999px] h-0 w-0 opacity-0"
          aria-hidden
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="contact-name">Nom</Label>
            <Input
              id="contact-name"
              name="name"
              required
              minLength={2}
              maxLength={120}
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="name"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="contact-email">Email</Label>
            <Input
              id="contact-email"
              name="email"
              type="email"
              required
              maxLength={254}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="contact-subject">Sujet</Label>
          <Input
            id="contact-subject"
            name="subject"
            required
            minLength={3}
            maxLength={200}
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="contact-message">Message</Label>
          <textarea
            id="contact-message"
            name="message"
            required
            minLength={10}
            maxLength={5000}
            rows={6}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            className="flex w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm shadow-sm placeholder:text-zinc-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
          />
        </div>

        {error ? (
          <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
            {error}
          </p>
        ) : null}
        {success ? (
          <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200">
            Message envoyé{ticketRef ? ` — réf. #${ticketRef}` : ""}. Un accusé de réception vous a été envoyé par
            e-mail. Réponse sous 48 h ouvrées en général. Consultez aussi la{" "}
            <a href="/help/faq" className="font-semibold underline">
              FAQ
            </a>{" "}
            ou l&apos;{" "}
            <a href="/support" className="font-semibold underline">
              assistant support
            </a>
            .
          </p>
        ) : null}

        <Button type="submit" disabled={busy} className="gap-2">
          {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Send className="size-4" aria-hidden />}
          Envoyer
        </Button>
      </form>
    </div>
  )
}
