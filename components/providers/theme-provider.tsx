"use client"

import { ThemeProvider as NextThemesProvider } from "next-themes"
import type { ThemeProviderProps } from "next-themes"

type Props = ThemeProviderProps

/**
 * React 19 / Next 16: next-themes FOUC script must not use default script type in the tree.
 * @see https://github.com/pacocoursey/next-themes/issues/387
 */
export function ThemeProvider({ children, ...props }: Props) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
      scriptProps={{ type: "application/json" }}
      {...props}
    >
      {children}
    </NextThemesProvider>
  )
}
