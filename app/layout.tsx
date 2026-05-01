import "./globals.css"

export default function RootLayout({children}:{children:React.ReactNode}) {
  return <html lang="en"><body className="min-h-screen bg-zinc-50 text-zinc-900 antialiased dark:bg-zinc-950 dark:text-zinc-50">{children}</body></html>
}
