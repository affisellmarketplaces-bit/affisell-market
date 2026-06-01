/**
 * One-shot Resend API test.
 * Run: npx tsx scripts/test-resend.ts
 *
 * Sandbox (onboarding@resend.dev): set TEST_EMAIL_TO to your Resend account email
 * (shown in the 403 error), e.g. affisellmarketplaces@gmail.com
 *
 * Production: verify a domain at resend.com/domains and set RESEND_FROM_EMAIL accordingly.
 */
import { config } from "dotenv"
import { resolve } from "node:path"
import { Resend } from "resend"

config({ path: resolve(process.cwd(), ".env.local") })
config({ path: resolve(process.cwd(), ".env") })

const apiKey = process.env.RESEND_API_KEY?.trim()
const from = process.env.RESEND_FROM_EMAIL?.trim() || "Affisell <onboarding@resend.dev>"
const isSandbox = from.includes("onboarding@resend.dev")
const to =
  process.env.TEST_EMAIL_TO?.trim() ||
  process.env.TEST_RESEND_TO?.trim() ||
  ""

if (!apiKey) {
  console.error("Missing RESEND_API_KEY in .env.local")
  process.exit(1)
}

if (isSandbox && !to) {
  console.error(`
Resend sandbox (onboarding@resend.dev) only delivers to your Resend account email.

Add to .env.local:
  TEST_EMAIL_TO=affisellmarketplaces@gmail.com

Then run: npx tsx scripts/test-resend.ts

For real customers (dreamdealsprice@gmail.com, etc.): verify a domain at
https://resend.com/domains and set:
  RESEND_FROM_EMAIL="Affisell <noreply@your-verified-domain.com>"
`)
  process.exit(1)
}

const resend = new Resend(apiKey)

function printSandbox403Help(message: string): void {
  const ownerMatch = message.match(/own email address \(([^)]+)\)/i)
  const owner = ownerMatch?.[1] ?? "your Resend account email"
  console.error(`
Resend 403 — sandbox restriction.

With onboarding@resend.dev you can ONLY send to: ${owner}
You tried: ${to || "(empty)"}

Fix for local dev (.env.local):
  TEST_EMAIL_TO=${owner}

Fix for production (Vercel):
  1. Verify domain at https://resend.com/domains
  2. RESEND_FROM_EMAIL="Affisell <noreply@your-domain.com>"
  3. Remove TEST_EMAIL_TO from Production env
`)
}

void (async () => {
  console.log("Sending test email…")
  console.log({ from, to, sandbox: isSandbox })

  try {
    const result = await resend.emails.send({
      from,
      to,
      subject: "Affisell — test Resend API",
      html: `
        <p>Ceci est un email de test envoyé par <code>scripts/test-resend.ts</code>.</p>
        <p>Horodatage : ${new Date().toISOString()}</p>
        ${isSandbox ? "<p><em>Mode sandbox Resend — destinataire limité au compte Resend.</em></p>" : ""}
      `.trim(),
    })

    if (result.error) {
      console.error("Resend error:", result.error)
      if (result.error.statusCode === 403 && isSandbox) {
        printSandbox403Help(result.error.message)
      }
      process.exit(1)
    }

    console.log("OK — email accepted by Resend:", result.data)
    if (isSandbox) {
      console.log(`Check inbox: ${to}`)
    }
  } catch (e) {
    console.error("Exception:", e instanceof Error ? e.message : e)
    process.exit(1)
  }
})()
