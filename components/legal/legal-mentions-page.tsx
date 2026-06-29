import Link from "next/link"
import { getTranslations } from "next-intl/server"

import { BentoCard, BentoContainer, BentoPageHeading, BentoShell } from "@/components/affisell/bento-ui"
import { readCompanyLegal } from "@/lib/legal/company-env"
import {
  EU_CONSUMER_ODR_URL,
  formatVatIntracommunautaire,
  VERCEL_HOST_LEGAL,
} from "@/lib/legal/mentions-constants"

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-0.5 border-b border-zinc-100 py-3 last:border-0 dark:border-zinc-800 sm:grid-cols-[minmax(0,220px)_1fr] sm:gap-4">
      <dt className="text-xs font-semibold uppercase tracking-wide text-zinc-500">{label}</dt>
      <dd className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{value}</dd>
    </div>
  )
}

export async function generateLegalMentionsMetadata() {
  const t = await getTranslations("legalPages.mentions")
  return { title: t("metaTitle"), description: t("metaDescription") }
}

export async function LegalMentionsPage() {
  const t = await getTranslations("legalPages.mentions")
  const c = readCompanyLegal()
  const vat = formatVatIntracommunautaire(c.tva)
  const host = VERCEL_HOST_LEGAL

  return (
    <BentoShell>
      <BentoContainer maxWidth="4xl" className="space-y-8 py-12">
        <BentoPageHeading eyebrow={t("eyebrow")} title={t("title")} description={t("description")} />

        <BentoCard className="p-0 sm:p-0">
          <article className="select-text px-5 py-6 sm:px-8 sm:py-8">
            <p className="mb-6 text-xs text-zinc-500">
              {t("lastUpdated")} {new Date().toISOString().slice(0, 10)}
            </p>

            <section className="mb-8" aria-labelledby="mentions-editor">
              <h2 id="mentions-editor" className="mb-4 text-lg font-bold text-zinc-900 dark:text-white">
                {t("editor.title")}
              </h2>
              <dl>
                <Field label={t("editor.denomination")} value={c.name} />
                <Field label={t("editor.form")} value={c.legalForm} />
                <Field label={t("editor.capital")} value={`${c.capital} €`} />
                <Field label={t("editor.siren")} value={c.siren} />
                <Field label={t("editor.rcs")} value={c.rcs} />
                <Field label={t("editor.vat")} value={vat} />
                <Field label={t("editor.seat")} value={c.domiciliationAddress} />
              </dl>
              <p className="mt-3 text-xs text-zinc-500">{t("editor.domiciliationNote")}</p>
            </section>

            <section className="mb-8" aria-labelledby="mentions-publisher">
              <h2
                id="mentions-publisher"
                className="mb-4 text-lg font-bold text-zinc-900 dark:text-white"
              >
                {t("publisher.title")}
              </h2>
              <dl>
                <Field label={t("publisher.director")} value={c.publisher} />
                <Field label={t("publisher.email")} value={c.contactEmail} />
              </dl>
              <p className="mt-3 text-xs text-zinc-500">{t("publisher.noPhone")}</p>
            </section>

            <section className="mb-8" aria-labelledby="mentions-dpo">
              <h2 id="mentions-dpo" className="mb-4 text-lg font-bold text-zinc-900 dark:text-white">
                {t("dpo.title")}
              </h2>
              <dl>
                <Field label={t("dpo.label")} value={c.dpoEmail} />
              </dl>
            </section>

            <section className="mb-8" aria-labelledby="mentions-host">
              <h2 id="mentions-host" className="mb-4 text-lg font-bold text-zinc-900 dark:text-white">
                {t("host.title")}
              </h2>
              <dl>
                <Field label={t("host.name")} value={host.name} />
                <Field
                  label={t("host.address")}
                  value={`${host.street}, ${host.city}, ${host.state} ${host.postalCode}, ${host.countryFr}`}
                />
                <Field label={t("host.website")} value={host.website.replace(/^https?:\/\//, "")} />
              </dl>
            </section>

            <section className="mb-8" aria-labelledby="mentions-mediation">
              <h2
                id="mentions-mediation"
                className="mb-4 text-lg font-bold text-zinc-900 dark:text-white"
              >
                {t("mediation.title")}
              </h2>
              <dl>
                <Field label={t("mediation.mediator")} value={c.mediatorName} />
                <Field label={t("mediation.site")} value={c.mediatorUrl} />
                <Field label={t("mediation.odr")} value={EU_CONSUMER_ODR_URL} />
              </dl>
              <p className="mt-3 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
                {t("mediation.body")}
              </p>
            </section>

            <section className="mb-8" aria-labelledby="mentions-ip">
              <h2 id="mentions-ip" className="mb-4 text-lg font-bold text-zinc-900 dark:text-white">
                {t("ip.title")}
              </h2>
              <p className="text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">{t("ip.body")}</p>
            </section>

            <section aria-labelledby="mentions-docs">
              <h2 id="mentions-docs" className="mb-4 text-lg font-bold text-zinc-900 dark:text-white">
                {t("docs.title")}
              </h2>
              <ul className="space-y-2 text-sm">
                <li>
                  <Link href="/cgu" className="text-violet-700 underline-offset-2 hover:underline dark:text-violet-300">
                    {t("docs.cgu")}
                  </Link>
                </li>
                <li>
                  <Link
                    href="/conditions-fournisseur"
                    className="text-violet-700 underline-offset-2 hover:underline dark:text-violet-300"
                  >
                    {t("docs.supplier")}
                  </Link>
                </li>
                <li>
                  <Link
                    href="/conditions-affilie"
                    className="text-violet-700 underline-offset-2 hover:underline dark:text-violet-300"
                  >
                    {t("docs.affiliate")}
                  </Link>
                </li>
                <li>
                  <Link
                    href="/privacy"
                    className="text-violet-700 underline-offset-2 hover:underline dark:text-violet-300"
                  >
                    {t("docs.privacy")}
                  </Link>
                </li>
                <li>
                  <Link
                    href="/protected-checkout"
                    className="text-violet-700 underline-offset-2 hover:underline dark:text-violet-300"
                  >
                    {t("docs.returns")}
                  </Link>
                </li>
                <li>
                  <Link
                    href="/cookies"
                    className="text-violet-700 underline-offset-2 hover:underline dark:text-violet-300"
                  >
                    {t("docs.cookies")}
                  </Link>
                </li>
              </ul>
            </section>
          </article>
        </BentoCard>
      </BentoContainer>
    </BentoShell>
  )
}
