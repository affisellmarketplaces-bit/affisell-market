"use client"

import { ChevronDown } from "lucide-react"
import type { ReactNode } from "react"
import { useState } from "react"
import { BentoCard } from "@/components/affisell/bento-ui"
import { cn } from "@/lib/utils"

type Item = { id: string; question: string; answer: ReactNode }

type Section = { id: string; title: string; items: Item[] }

export function FaqAccordion({ sections }: { sections: Section[] }) {
  const [openId, setOpenId] = useState<string | null>(sections[0]?.items[0]?.id ?? null)

  return (
    <div className="space-y-8">
      {sections.map((section) => (
        <div key={section.id}>
          <h2 className="mb-3 text-xs font-bold uppercase tracking-wider text-violet-600 dark:text-violet-400">
            {section.title}
          </h2>
          <div className="space-y-2">
            {section.items.map((item) => {
              const open = openId === item.id
              return (
                <BentoCard key={item.id} id={item.id === "cashback" ? "cashback" : undefined} className="overflow-hidden">
                  <button
                    type="button"
                    className="flex w-full items-start justify-between gap-3 p-5 text-left"
                    onClick={() => setOpenId(open ? null : item.id)}
                    aria-expanded={open}
                  >
                    <span className="text-sm font-semibold text-zinc-900 dark:text-white">{item.question}</span>
                    <ChevronDown
                      className={cn("mt-0.5 size-4 shrink-0 text-zinc-400 transition", open && "rotate-180")}
                      aria-hidden
                    />
                  </button>
                  {open ? (
                    <div className="border-t border-zinc-100 px-5 pb-5 pt-3 text-sm leading-relaxed text-zinc-600 dark:border-zinc-800 dark:text-zinc-400">
                      {item.answer}
                    </div>
                  ) : null}
                </BentoCard>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
