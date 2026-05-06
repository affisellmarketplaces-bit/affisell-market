"use client"

import Link from "next/link"
import { useTranslations } from "next-intl"
import { useEffect, useMemo, useState } from "react"
import {
  Camera,
  ChevronRight,
  Clock,
  Flame,
  Mic,
  Sparkles,
  TrendingUp,
  User,
  X,
  Zap,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Sheet, SheetContent } from "@/components/ui/sheet"

type TrendingItem = { id: string; slug: string; name: string; viewers: number }
type PersonalizedItem = { id: string; slug: string; name: string; match: number }

const digitalItems = [
  { name: "Audible", href: "/marketplace?category=Digital" },
  { name: "Kindle eBooks", href: "/marketplace?category=Books" },
  { name: "Music", href: "/marketplace?category=Music" },
  { name: "Prime Video", href: "/marketplace?category=Entertainment" },
]

const departments = [
  { slug: "fashion", name: "Fashion", count: 312, isNew: true },
  { slug: "beauty", name: "Beauty", count: 148, isNew: false },
  { slug: "electronics", name: "Electronics", count: 221, isNew: false },
  { slug: "home", name: "Home", count: 196, isNew: true },
]

export function CategoryDrawer({
  open,
  setOpen,
}: {
  open: boolean
  setOpen: (open: boolean) => void
}) {
  const t = useTranslations("Menu")
  const [searchQuery, setSearchQuery] = useState("")
  const [trending, setTrending] = useState<TrendingItem[]>([])
  const [personalized, setPersonalized] = useState<PersonalizedItem[]>([])

  useEffect(() => {
    let cancelled = false
    void fetch("/api/trending")
      .then((r) => r.json())
      .then((data: unknown) => {
        if (cancelled) return
        if (Array.isArray(data)) {
          setTrending(
            data
              .map((it) => {
                const row = it as Partial<TrendingItem>
                if (!row?.id || !row?.slug || !row?.name) return null
                return {
                  id: row.id,
                  slug: row.slug,
                  name: row.name,
                  viewers: typeof row.viewers === "number" ? row.viewers : 0,
                }
              })
              .filter((x): x is TrendingItem => x !== null)
          )
        }
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    const history = localStorage.getItem("browsing_history")
    if (!history) return
    let cancelled = false
    void fetch("/api/ai/personalized-menu", {
      method: "POST",
      body: history,
    })
      .then((r) => r.json())
      .then((data: unknown) => {
        if (cancelled || !Array.isArray(data)) return
        setPersonalized(
          data
            .map((it) => {
              const row = it as Partial<PersonalizedItem>
              if (!row?.id || !row?.slug || !row?.name) return null
              return {
                id: row.id,
                slug: row.slug,
                name: row.name,
                match: typeof row.match === "number" ? row.match : 0,
              }
            })
            .filter((x): x is PersonalizedItem => x !== null)
        )
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  const filteredDepartments = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return departments
    return departments.filter((d) => d.name.toLowerCase().includes(q))
  }, [searchQuery])

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetContent side="left" className="w-[24rem] p-0 bg-white">
        <div className="bg-gradient-to-r from-slate-900 via-purple-900 to-slate-900 p-4 text-white">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <User className="h-6 w-6" />
              <span className="text-lg font-bold">{t("helloSignin")}</span>
            </div>
            <button type="button" onClick={() => setOpen(false)} aria-label="Close drawer">
              <X className="h-6 w-6" />
            </button>
          </div>

          <div className="relative">
            <Input
              placeholder={t("searchAskAi")}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="border-white/20 bg-white/10 pr-20 text-white placeholder:text-white/60"
            />
            <div className="absolute right-2 top-1/2 flex -translate-y-1/2 gap-1">
              <button type="button" className="rounded p-1.5 hover:bg-white/10">
                <Mic className="h-4 w-4" />
              </button>
              <button type="button" className="rounded p-1.5 hover:bg-white/10">
                <Camera className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        <ScrollArea className="h-[calc(100vh-140px)]">
          <div className="border-b bg-gradient-to-br from-violet-50 to-fuchsia-50 p-4">
            <button className="group flex w-full items-center gap-3 rounded-lg bg-white p-3 transition-all hover:shadow-md">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-500">
                <Sparkles className="h-5 w-5 text-white" />
              </div>
              <div className="flex-1 text-left">
                <p className="text-sm font-semibold text-gray-900">Ask Affisell AI</p>
                <p className="text-xs text-gray-600">Find products in seconds</p>
              </div>
              <ChevronRight className="h-4 w-4 text-gray-400 transition-transform group-hover:translate-x-1" />
            </button>
          </div>

          {trending.length > 0 ? (
            <div className="border-b border-gray-200 bg-amber-50/50 py-4">
              <h3 className="flex items-center gap-2 px-6 pb-2 text-sm font-bold text-gray-900">
                <Flame className="h-4 w-4 text-orange-500" />
                Trending Now
                <Badge variant="secondary" className="ml-auto bg-orange-100 text-orange-700">
                  Live
                </Badge>
              </h3>
              {trending.slice(0, 3).map((item) => (
                <Link
                  key={item.id}
                  href={`/product/${item.slug}`}
                  className="group flex items-center gap-3 px-6 py-2.5 text-sm hover:bg-white/80"
                >
                  <TrendingUp className="h-4 w-4 text-orange-500" />
                  <span className="flex-1 text-gray-700">{item.name}</span>
                  <Badge variant="outline" className="text-xs">
                    {item.viewers} viewing
                  </Badge>
                </Link>
              ))}
            </div>
          ) : null}

          {personalized.length > 0 ? (
            <div className="border-b border-gray-200 bg-violet-50/50 py-4">
              <h3 className="flex items-center gap-2 px-6 pb-2 text-sm font-bold text-gray-900">
                <Zap className="h-4 w-4 text-violet-600" />
                Picked For You
              </h3>
              {personalized.map((item) => (
                <Link
                  key={item.id}
                  href={`/category/${item.slug}`}
                  className="flex items-center justify-between px-6 py-2.5 text-sm text-gray-700 hover:bg-white/80"
                >
                  {item.name}
                  <Badge className="bg-violet-100 text-xs text-violet-700">
                    {item.match}% match
                  </Badge>
                </Link>
              ))}
            </div>
          ) : null}

          <div className="border-b border-gray-200 py-4">
            <h3 className="px-6 pb-2 text-base font-bold text-gray-900">
              Digital Content & Devices
            </h3>
            {digitalItems.map((item) => (
              <Link
                key={item.name}
                href={item.href}
                className="group flex items-center justify-between px-6 py-3 text-sm text-gray-700 hover:bg-gray-50"
              >
                <span className="transition-transform group-hover:translate-x-1">{item.name}</span>
                <ChevronRight className="h-4 w-4 text-gray-400" />
              </Link>
            ))}
          </div>

          <div className="border-b border-gray-200 py-4">
            <h3 className="px-6 pb-2 text-base font-bold text-gray-900">Shop by Department</h3>
            {filteredDepartments.map((dept) => (
              <Link
                key={dept.slug}
                href={`/category/${dept.slug}`}
                className="group flex items-center justify-between px-6 py-3 text-sm text-gray-700 hover:bg-gray-50"
              >
                <span className="transition-transform group-hover:translate-x-1">{dept.name}</span>
                <div className="flex items-center gap-2">
                  {dept.isNew ? (
                    <Badge className="bg-emerald-500 px-1.5 text-xs text-white">NEW</Badge>
                  ) : null}
                  <span className="text-xs text-gray-400">{dept.count}</span>
                  <ChevronRight className="h-4 w-4 text-gray-400" />
                </div>
              </Link>
            ))}
          </div>

          <div className="bg-gray-50 py-4">
            <h3 className="flex items-center gap-2 px-6 pb-2 text-sm font-semibold text-gray-600">
              <Clock className="h-4 w-4" />
              Recently Viewed
            </h3>
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  )
}
