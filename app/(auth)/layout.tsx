import { AuthLocaleToolbar } from "@/components/auth/auth-locale-toolbar"

export default function AuthGroupLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <AuthLocaleToolbar />
      {children}
    </>
  )
}
