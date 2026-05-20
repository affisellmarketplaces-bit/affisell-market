"use client"

import { Moon, Sun } from "lucide-react"
import { useTheme } from "next-themes"
import { useTranslations } from "next-intl"

import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  const t = useTranslations("PublicNav")

  return (
    <button
      type="button"
      className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "relative px-2")}
      onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
      aria-label={t("themeToggle")}
    >
      <Sun className="h-4 w-4 rotate-0 scale-100 transition dark:-rotate-90 dark:scale-0" aria-hidden />
      <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition dark:rotate-0 dark:scale-100" aria-hidden />
    </button>
  )
}
