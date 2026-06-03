import { AuthLocaleToolbar } from "@/components/auth/auth-locale-toolbar"

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <AuthLocaleToolbar />
      {children}
    </>
  )
}
