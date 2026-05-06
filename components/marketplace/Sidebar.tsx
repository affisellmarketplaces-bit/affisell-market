"use client"

import { useState } from "react"
import useSWR from "swr"

import { ChevronDown, ChevronRight, Grid3x3, Loader2 } from "lucide-react"

const fetcher = (url: string) => fetch(url).then((r) => r.json())

type ApiCategory = {
  id: string
  name: string
  icon: string
  slug: string
  order: number
  subcategories: Array<{ id: string; name: string; slug: string }>
}

export function Sidebar() {
  const [expandedCats, setExpandedCats] = useState<string[]>([])
  const { data, isLoading, error } = useSWR<{ categories: ApiCategory[] }>("/api/categories", fetcher)

  const toggleCategory = (catId: string) => {
    setExpandedCats((prev) =>
      prev.includes(catId) ? prev.filter((c) => c !== catId) : [...prev, catId]
    )
  }

  if (isLoading) {
    return (
      <aside className="flex h-[calc(100vh-80px)] w-[19rem] shrink-0 items-center justify-center self-start border-r border-gray-200 bg-white lg:sticky lg:top-[5.25rem]">
        <Loader2 className="h-8 w-8 animate-spin text-violet-600" />
      </aside>
    )
  }

  if (error || !data?.categories?.length) {
    return (
      <aside className="h-[calc(100vh-80px)] w-[19rem] shrink-0 self-start overflow-y-auto border-r border-gray-200 bg-white p-4 lg:sticky lg:top-[5.25rem]">
        <p className="text-sm text-red-600">Could not load categories.</p>
      </aside>
    )
  }

  return (
    <aside className="sticky top-[5.25rem] flex h-[calc(100vh-80px)] w-[19rem] shrink-0 flex-col self-start overflow-y-auto border-r border-gray-200 bg-white lg:top-[5.25rem]">
      <div className="sticky top-0 z-10 bg-gradient-to-r from-slate-900 to-slate-700 px-4 py-4">
        <h2 className="flex items-center gap-2 text-lg font-black uppercase tracking-wider text-white">
          <Grid3x3 className="h-5 w-5" strokeWidth={3} />
          CATEGORY
        </h2>
      </div>

      <div className="bg-white">
        {data.categories.map((cat) => (
          <div key={cat.id} className="border-b border-gray-100">
            <button
              type="button"
              onClick={() => toggleCategory(cat.id)}
              className="flex w-full items-center justify-between px-4 py-3 text-left text-sm text-gray-800 transition-colors hover:bg-slate-50"
            >
              <span className="flex min-w-0 items-center gap-2">
                <span className="shrink-0 text-lg">{cat.icon}</span>
                <span className="font-semibold">{cat.name}</span>
              </span>
              {expandedCats.includes(cat.id) ? (
                <ChevronDown className="h-4 w-4 shrink-0 text-gray-400" />
              ) : (
                <ChevronRight className="h-4 w-4 shrink-0 text-gray-400" />
              )}
            </button>

            {expandedCats.includes(cat.id) &&
              cat.subcategories?.map((sub) => (
                <button
                  key={sub.id}
                  type="button"
                  className="w-full py-2 pl-12 pr-4 text-left text-sm text-gray-600 hover:bg-slate-50 hover:text-gray-900"
                >
                  {sub.name}
                </button>
              ))}
          </div>
        ))}
      </div>
    </aside>
  )
}
