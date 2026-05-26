import Link from "next/link"
import { getTranslations } from "next-intl/server"
import { ArrowRight, Calendar, Clock } from "lucide-react"

import { BentoCard, BentoContainer, BentoPageHeading, BentoShell } from "@/components/affisell/bento-ui"
import { CompanyNav } from "@/components/company/company-nav"
import { BLOG_POST_SLUGS } from "@/lib/company/types"
import { cn } from "@/lib/utils"

export async function generateMetadata() {
  const t = await getTranslations("companyPages.blog")
  return { title: t("metaTitle"), description: t("metaDescription") }
}

export default async function BlogIndexPage() {
  const t = await getTranslations("companyPages.blog")

  const posts = BLOG_POST_SLUGS.map((slug) => ({
    slug,
    title: t(`posts.${slug}.title`),
    excerpt: t(`posts.${slug}.excerpt`),
    date: t(`posts.${slug}.date`),
    category: t(`posts.${slug}.category`),
    readMin: t(`posts.${slug}.readMin`),
  })).sort((a, b) => b.date.localeCompare(a.date))

  return (
    <BentoShell>
      <BentoContainer maxWidth="5xl" className="space-y-10 py-12">
        <CompanyNav active="blog" />
        <BentoPageHeading eyebrow={t("eyebrow")} title={t("title")} description={t("description")} />

        <div className="grid gap-4">
          {posts.map((post, i) => (
            <Link key={post.slug} href={`/blog/${post.slug}`} className="group block">
              <BentoCard
                className={cn(
                  "flex flex-col gap-4 transition hover:border-violet-200 hover:shadow-md dark:hover:border-violet-800",
                  i === 0 && "border-violet-200/80 bg-gradient-to-br from-violet-50/80 to-white dark:from-violet-950/30 dark:to-zinc-950"
                )}
              >
                <div className="flex flex-wrap items-center gap-3 text-xs font-medium uppercase tracking-wider text-zinc-500">
                  <span className="rounded-full bg-violet-500/10 px-2.5 py-0.5 text-violet-700 dark:text-violet-300">
                    {post.category}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Calendar className="size-3.5" aria-hidden />
                    {post.date}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Clock className="size-3.5" aria-hidden />
                    {post.readMin}
                  </span>
                </div>
                <div>
                  <h2 className="text-xl font-bold tracking-tight group-hover:text-violet-700 dark:group-hover:text-violet-300">
                    {post.title}
                  </h2>
                  <p className="mt-2 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">{post.excerpt}</p>
                </div>
                <span className="inline-flex items-center text-sm font-semibold text-violet-700 dark:text-violet-300">
                  {t("readMore")}
                  <ArrowRight className="ml-1 size-4 transition group-hover:translate-x-0.5" aria-hidden />
                </span>
              </BentoCard>
            </Link>
          ))}
        </div>
      </BentoContainer>
    </BentoShell>
  )
}
