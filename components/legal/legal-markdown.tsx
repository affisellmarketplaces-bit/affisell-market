"use client"

import Link from "next/link"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"

import { slugifyHeading } from "@/lib/legal/documents"
import { cn } from "@/lib/utils"

type Props = {
  content: string
  className?: string
}

export function LegalMarkdown({ content, className }: Props) {
  return (
    <div
      className={cn(
        "legal-prose prose-zinc max-w-none dark:prose-invert",
        "prose-headings:scroll-mt-24 prose-headings:font-semibold prose-h1:text-2xl prose-h2:text-lg prose-h3:text-base",
        "prose-p:text-sm prose-p:leading-relaxed prose-li:text-sm",
        "prose-a:text-violet-700 prose-a:no-underline hover:prose-a:underline dark:prose-a:text-violet-300",
        className
      )}
    >
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        h1: ({ children }) => {
          const text = String(children)
          return (
            <h1 id={slugifyHeading(text)} className="text-2xl font-bold tracking-tight">
              {children}
            </h1>
          )
        },
        h2: ({ children }) => {
          const text = String(children)
          return (
            <h2 id={slugifyHeading(text)} className="mt-10 border-t border-zinc-200 pt-8 dark:border-zinc-800">
              {children}
            </h2>
          )
        },
        h3: ({ children }) => {
          const text = String(children)
          return (
            <h3 id={slugifyHeading(text)} className="mt-6">
              {children}
            </h3>
          )
        },
        a: ({ href, children }) => {
          if (href?.startsWith("/")) {
            return (
              <Link href={href} className="font-medium text-violet-700 underline-offset-4 hover:underline dark:text-violet-300">
                {children}
              </Link>
            )
          }
          return (
            <a href={href} target="_blank" rel="noopener noreferrer" className="font-medium text-violet-700 underline-offset-4 hover:underline dark:text-violet-300">
              {children}
            </a>
          )
        },
        table: ({ children }) => (
          <div className="my-4 overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
            <table className="min-w-full text-left text-sm">{children}</table>
          </div>
        ),
        th: ({ children }) => (
          <th className="border-b border-zinc-200 bg-zinc-50 px-3 py-2 font-semibold dark:border-zinc-800 dark:bg-zinc-900">
            {children}
          </th>
        ),
        td: ({ children }) => <td className="border-b border-zinc-100 px-3 py-2 dark:border-zinc-800">{children}</td>,
      }}
    >
      {content}
    </ReactMarkdown>
    </div>
  )
}
