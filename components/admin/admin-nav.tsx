"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Menu, Search, X } from "lucide-react";

import { AdminAuthActions } from "@/components/admin/admin-auth-actions";
import {
  ADMIN_NAV_GROUPS,
  ADMIN_NAV_LINKS,
  adminNavCurrent,
  isAdminNavActive,
} from "@/lib/admin/admin-nav-links";
import type { AdminNavSession } from "@/lib/admin/admin-nav-session";
import { cn } from "@/lib/utils";

export function AdminNav({ session }: { session: AdminNavSession | null }) {
  const pathname = usePathname() ?? "";
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [mounted, setMounted] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const current = adminNavCurrent(pathname);

  useEffect(() => setMounted(true), []);

  // Close the drawer on navigation.
  useEffect(() => {
    setOpen(false);
    setQuery("");
  }, [pathname]);

  // Scroll lock + Escape + focus while the drawer is open.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    const raf = requestAnimationFrame(() => searchRef.current?.focus());
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
      cancelAnimationFrame(raf);
    };
  }, [open]);

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    return ADMIN_NAV_GROUPS.map((g) => ({
      ...g,
      links: ADMIN_NAV_LINKS.filter(
        (l) =>
          l.group === g.id &&
          (!q ||
            l.label.toLowerCase().includes(q) ||
            g.label.toLowerCase().includes(q)),
      ),
    })).filter((g) => g.links.length > 0);
  }, [query]);

  return (
    <header className="sticky top-0 z-50 border-b border-zinc-200 bg-white/95 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/95">
      {/* Compact bar (below lg): brand, current section, menu. */}
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-4 lg:hidden">
        <Link
          href="/admin/terminal"
          className="shrink-0 text-sm font-bold text-violet-700 dark:text-violet-300"
        >
          Affisell Admin
        </Link>
        {current ? (
          <span className="min-w-0 flex-1 truncate rounded-full bg-violet-100 px-3 py-1 text-xs font-semibold text-violet-900 dark:bg-violet-950/80 dark:text-violet-100">
            {current.label}
          </span>
        ) : (
          <span className="flex-1" />
        )}
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-expanded={open}
          aria-controls="admin-nav-drawer"
          className="inline-flex size-11 shrink-0 items-center justify-center rounded-xl border border-zinc-200 text-zinc-700 transition hover:bg-zinc-100 active:scale-95 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-900"
        >
          <Menu className="size-5" aria-hidden />
          <span className="sr-only">Menu</span>
        </button>
      </div>

      {/* Full bar (lg and up): unchanged wrapped links. */}
      <div className="mx-auto hidden max-w-6xl flex-wrap items-center gap-3 px-6 py-3 lg:flex">
        <Link
          href="/admin/terminal"
          className="text-sm font-bold text-violet-700 dark:text-violet-300"
        >
          Affisell Admin
        </Link>
        <nav
          className="flex flex-1 flex-wrap gap-1"
          aria-label="Administration"
        >
          {ADMIN_NAV_LINKS.map((link) => {
            const active = isAdminNavActive(link.href, pathname);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
                  active
                    ? "bg-violet-100 text-violet-900 dark:bg-violet-950/80 dark:text-violet-100"
                    : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-900",
                )}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="text-xs text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
          >
            Site public
          </Link>
          <AdminAuthActions session={session} />
        </div>
      </div>

      {open && mounted
        ? createPortal(
            <div
              id="admin-nav-drawer"
              role="dialog"
              aria-modal="true"
              aria-label="Navigation administration"
              className="fixed inset-0 z-[60] flex flex-col bg-white dark:bg-zinc-950 lg:hidden"
            >
              <div className="flex h-14 shrink-0 items-center gap-2 border-b border-zinc-200 px-4 dark:border-zinc-800">
                <div className="relative flex-1">
                  <Search
                    className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-400"
                    aria-hidden
                  />
                  <input
                    ref={searchRef}
                    type="search"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Rechercher une page…"
                    aria-label="Rechercher une page"
                    className="h-11 w-full rounded-xl border border-zinc-200 bg-zinc-50 pl-9 pr-3 text-base outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-500/20 dark:border-zinc-700 dark:bg-zinc-900"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="inline-flex size-11 shrink-0 items-center justify-center rounded-xl border border-zinc-200 text-zinc-700 active:scale-95 dark:border-zinc-700 dark:text-zinc-200"
                >
                  <X className="size-5" aria-hidden />
                  <span className="sr-only">Fermer</span>
                </button>
              </div>

              <nav
                className="flex-1 overflow-y-auto overscroll-contain px-4 py-4"
                aria-label="Administration"
              >
                {groups.length === 0 ? (
                  <p className="py-10 text-center text-sm text-zinc-500">
                    Aucune page ne correspond.
                  </p>
                ) : (
                  groups.map((g) => (
                    <section key={g.id} className="mb-5">
                      <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                        {g.label}
                      </h2>
                      <ul className="grid grid-cols-2 gap-2">
                        {g.links.map((link) => {
                          const active = isAdminNavActive(link.href, pathname);
                          return (
                            <li key={link.href}>
                              <Link
                                href={link.href}
                                aria-current={active ? "page" : undefined}
                                className={cn(
                                  "flex min-h-11 items-center rounded-xl border px-3 text-sm font-medium transition active:scale-[0.98]",
                                  active
                                    ? "border-violet-300 bg-violet-100 text-violet-900 dark:border-violet-800 dark:bg-violet-950/80 dark:text-violet-100"
                                    : "border-zinc-200 text-zinc-700 hover:bg-zinc-50 dark:border-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-900",
                                )}
                              >
                                <span className="truncate">{link.label}</span>
                              </Link>
                            </li>
                          );
                        })}
                      </ul>
                    </section>
                  ))
                )}
              </nav>

              <div
                className="flex shrink-0 items-center justify-between gap-3 border-t border-zinc-200 px-4 py-3 dark:border-zinc-800"
                style={{
                  paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))",
                }}
              >
                <Link
                  href="/"
                  className="inline-flex min-h-11 items-center text-sm text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
                >
                  Site public
                </Link>
                <AdminAuthActions session={session} />
              </div>
            </div>,
            document.body,
          )
        : null}
    </header>
  );
}
