import { AuthLocaleToolbar } from "@/components/auth/auth-locale-toolbar"

export default function SignupLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <AuthLocaleToolbar />
      {children}
    </>
  )
}
