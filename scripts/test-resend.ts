/**
 * One-shot Resend API test.
 * Run: npx tsx scripts/test-resend.ts
 */
import { config } from "dotenv"
import { resolve } from "node:path"
import { Resend } from "resend"

config({ path: resolve(process.cwd(), ".env.local") })
config({ path: resolve(process.cwd(), ".env") })

const TO = process.env.TEST_RESEND_TO?.trim() || "nelson@gmail.com"
const apiKey = process.env.RESEND_API_KEY?.trim()
const from = process.env.RESEND_FROM_EMAIL?.trim() || "Affisell <onboarding@resend.dev>"

if (!apiKey) {
  console.error("Missing RESEND_API_KEY in .env.local")
  process.exit(1)
}

const resend = new Resend(apiKey)

void (async () => {
  console.log("Sending test email…")
  console.log({ from, to: TO })

  try {
    const result = await resend.emails.send({
      from,
      to: TO,
      subject: "Affisell — test Resend API",
      html: `
        <p>Ceci est un email de test envoyé par <code>scripts/test-resend.ts</code>.</p>
        <p>Horodatage : ${new Date().toISOString()}</p>
      `.trim(),
    })

    if (result.error) {
      console.error("Resend error:", result.error)
      process.exit(1)
    }

    console.log("OK — email accepted by Resend:", result.data)
  } catch (e) {
    console.error("Exception:", e instanceof Error ? e.message : e)
    process.exit(1)
  }
})()
