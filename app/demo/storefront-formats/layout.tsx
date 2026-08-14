/** Wider canvas for the storefront formats catalog (parent Demo Lab shell is max-w-3xl). */
export default function StorefrontFormatsLabLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="relative left-1/2 w-screen max-w-none -translate-x-1/2 px-4 sm:px-6">
      <div className="mx-auto max-w-6xl">{children}</div>
    </div>
  )
}
