import Link from "next/link"

import { BuyerAccountSignOutButton } from "@/components/buyer-account-sign-out-button"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type Props = {
  name: string | null
  image: string | null
}

export function BuyerAccountHeaderActions({ name, image }: Props) {
  const display = name?.trim() || "Mon compte"
  const initial = display.slice(0, 1).toUpperCase()

  return (
    <div className="flex shrink-0 items-center gap-3 self-start sm:pt-1">
      <Link
        href="/marketplace/account"
        className={cn(
          buttonVariants({ variant: "ghost", size: "sm" }),
          "gap-2 px-2 text-zinc-800 hover:bg-violet-50 dark:text-zinc-100 dark:hover:bg-violet-950/50"
        )}
      >
        <span className="flex size-8 items-center justify-center overflow-hidden rounded-full border border-violet-200/80 bg-violet-100 text-sm font-semibold text-violet-900 dark:border-violet-800/60 dark:bg-violet-950 dark:text-violet-100">
          {image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={image} alt="" className="size-full object-cover" />
          ) : (
            initial
          )}
        </span>
        <span className="hidden max-w-[10rem] truncate font-medium sm:inline">{display}</span>
      </Link>
      <BuyerAccountSignOutButton />
    </div>
  )
}
