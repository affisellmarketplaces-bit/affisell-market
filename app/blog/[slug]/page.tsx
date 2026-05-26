import Link from "next/link"
import { notFound } from "next/navigation"
import { getTranslations } from "next-intl/server"
import { ArrowLeft, Calendar, Clock } from "lucide-react"

import { BentoCard, BentoContainer, BentoShell } from "@/components/affisell/bento-ui"
import { CompanyNav } from "@/components/company/company-nav"
import { BLOG_POST_SLUGS, isBlogPostSlug, type BlogPostSlug } from "@/lib/company/types"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type Props = { params: Promise<{ slug: string }> }

export async function generateStaticParams() {
  return BLOG_POST_SLUGS.map((slug) => ({ slug }))
}

export async function generateMetadata({ params }: Props) {
  const { slug } = await params
  if (!isBlogPostSlug(slug)) return { title: "Article" }
  const t = await getTranslations("companyPages.blog")
  return {
    title: t(`posts.${slug}.title`),
    description: t(`posts.${slug}.excerpt`),
  }
}

export default async function BlogPostPage({ params }: Props) {
  const { slug } = await params
  if (!isBlogPostSlug(slug)) notFound()

  const t = await getTranslations("companyPages.blog")
  const post = slug as BlogPostSlug

  const sections = ["s1", "s2", "s3"] as const

  return (
    <BentoShell>
      <BentoContainer maxWidth="4xl" className="space-y-8 py-12">
        <CompanyNav active="blog" />

        <Link
          href="/blog"
          className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "w-fit gap-1 text-zinc-600")}
        >
          <ArrowLeft className="size-4" aria-hidden />
          {t("backToBlog")}
        </Link>

        <header className="space-y-4">
          <div className="flex flex-wrap items-center gap-3 text-xs font-medium uppercase tracking-wider text-zinc-500">
            <span className="rounded-full bg-violet-500/10 px-2.5 py-0.5 text-violet-700 dark:text-violet-300">
              {t(`posts.${post}.category`)}
            </span>
            <span className="inline-flex items-center gap-1">
              <Calendar className="size-3.5" aria-hidden />
              {t(`posts.${post}.date`)}
            </span>
            <span className="inline-flex items-center gap-1">
              <Clock className="size-3.5" aria-hidden />
              {t(`posts.${post}.readMin`)}
            </span>
          </div>
          <h1 className="text-balance text-3xl font-bold tracking-tight sm:text-4xl">
            {t(`posts.${post}.title`)}
          </h1>
          <p className="text-lg leading-relaxed text-zinc-600 dark:text-zinc-300">
            {t(`posts.${post}.excerpt`)}
          </p>
        </header>

        <BentoCard className="prose prose-zinc max-w-none space-y-8 dark:prose-invert">
          <p className="lead text-base leading-relaxed">{t(`posts.${post}.sections.intro`)}</p>
          {sections.map((key) => (
            <section key={key} className="space-y-3">
              <h2 className="text-xl font-bold tracking-tight">{t(`posts.${post}.sections.${key}.title`)}</h2>
              <p className="leading-relaxed text-zinc-600 dark:text-zinc-300">
                {t(`posts.${post}.sections.${key}.body`)}
              </p>
            </section>
          ))}
        </BentoCard>
      </BentoContainer>
    </BentoShell>
  )
}
