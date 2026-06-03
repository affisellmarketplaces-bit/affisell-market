import { LanguageSwitcher } from "@/components/LanguageSwitcher"

/** Login / signup — main nav hidden; keep locale control reachable. */
export function AuthLocaleToolbar() {
  return (
    <div
      className="pointer-events-none fixed inset-x-0 top-0 z-[300] flex justify-end px-4 pt-[max(0.75rem,env(safe-area-inset-top))]"
      aria-hidden={false}
    >
      <div className="pointer-events-auto">
        <LanguageSwitcher />
      </div>
    </div>
  )
}
