import type { PaymentMethodBrandId } from "@/lib/payment-method-brands"
import { cn } from "@/lib/utils"

type IconProps = { className?: string }

function CbIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 48 32" className={className} aria-hidden>
      <rect width="48" height="32" rx="4" fill="#fff" />
      <path d="M0 0h24v32H0z" fill="#2E3192" />
      <path d="M24 0h24v32H24z" fill="#E30613" />
      <text
        x="24"
        y="20"
        textAnchor="middle"
        fill="#fff"
        fontSize="11"
        fontWeight="700"
        fontFamily="system-ui, sans-serif"
      >
        CB
      </text>
    </svg>
  )
}

function VisaIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 48 32" className={className} aria-hidden>
      <rect width="48" height="32" rx="4" fill="#fff" />
      <text
        x="24"
        y="21"
        textAnchor="middle"
        fill="#1A1F71"
        fontSize="13"
        fontWeight="700"
        fontStyle="italic"
        fontFamily="system-ui, sans-serif"
      >
        VISA
      </text>
    </svg>
  )
}

function MastercardIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 48 32" className={className} aria-hidden>
      <rect width="48" height="32" rx="4" fill="#fff" />
      <circle cx="19" cy="16" r="9" fill="#EB001B" />
      <circle cx="29" cy="16" r="9" fill="#F79E1B" />
      <path
        d="M24 9.2a9 9 0 0 1 0 13.6A9 9 0 0 1 24 9.2Z"
        fill="#FF5F00"
      />
    </svg>
  )
}

function AmexIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 48 32" className={className} aria-hidden>
      <rect width="48" height="32" rx="4" fill="#2E77BC" />
      <text
        x="24"
        y="14"
        textAnchor="middle"
        fill="#fff"
        fontSize="6.5"
        fontWeight="700"
        fontFamily="system-ui, sans-serif"
      >
        AMERICAN
      </text>
      <text
        x="24"
        y="22"
        textAnchor="middle"
        fill="#fff"
        fontSize="6.5"
        fontWeight="700"
        fontFamily="system-ui, sans-serif"
      >
        EXPRESS
      </text>
    </svg>
  )
}

function OneyIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 48 32" className={className} aria-hidden>
      <rect width="48" height="32" rx="4" fill="#fff" />
      <text
        x="24"
        y="21"
        textAnchor="middle"
        fill="#81BC00"
        fontSize="14"
        fontWeight="700"
        fontFamily="system-ui, sans-serif"
      >
        oney
      </text>
    </svg>
  )
}

function PaypalIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 48 32" className={className} aria-hidden>
      <rect width="48" height="32" rx="4" fill="#fff" />
      <text x="14" y="21" fill="#003087" fontSize="11" fontWeight="700" fontFamily="system-ui, sans-serif">
        Pay
      </text>
      <text x="28" y="21" fill="#009CDE" fontSize="11" fontWeight="700" fontFamily="system-ui, sans-serif">
        Pal
      </text>
    </svg>
  )
}

function ApplePayIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 48 32" className={className} aria-hidden>
      <rect width="48" height="32" rx="4" fill="#fff" />
      <path
        d="M15.2 9.8c-.6.7-1.5 1.2-2.4 1.1-.1-1 .4-2 1-2.6.6-.7 1.7-1.2 2.5-1.2.1 1-.3 1.9-.9 2.7Zm.9 1.4c-1.3-.1-2.4.7-3 .7-.6 0-1.6-.7-2.6-.7-1.3 0-2.6.8-3.3 2-1.4 2.5-.4 6.1 1 8.1.7 1 1.5 2.1 2.6 2.1 1 0 1.4-.7 2.6-.7 1.2 0 1.5.7 2.6.7 1.1 0 1.8-1 2.5-2 .8-1.2 1.1-2.3 1.1-2.4-.1 0-2.2-.8-2.2-3.3 0-2.1 1.7-3.1 1.8-3.2-1-.1-2.3-1.2-2.9-1.2Z"
        fill="#000"
        transform="translate(6 4) scale(1.05)"
      />
      <text x="30" y="21" fill="#000" fontSize="11" fontWeight="600" fontFamily="system-ui, sans-serif">
        Pay
      </text>
    </svg>
  )
}

function GooglePayIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 48 32" className={className} aria-hidden>
      <rect width="48" height="32" rx="4" fill="#fff" />
      <text x="13" y="21" fontSize="12" fontWeight="700" fontFamily="system-ui, sans-serif">
        <tspan fill="#4285F4">G</tspan>
      </text>
      <text x="22" y="21" fill="#000" fontSize="11" fontWeight="600" fontFamily="system-ui, sans-serif">
        Pay
      </text>
    </svg>
  )
}

function KlarnaIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 48 32" className={className} aria-hidden>
      <rect width="48" height="32" rx="4" fill="#FFB3C7" />
      <text
        x="24"
        y="20"
        textAnchor="middle"
        fill="#0A0A0A"
        fontSize="11"
        fontWeight="700"
        fontFamily="system-ui, sans-serif"
      >
        Klarna
      </text>
    </svg>
  )
}

const ICONS: Record<PaymentMethodBrandId, (props: IconProps) => React.JSX.Element> = {
  cb: CbIcon,
  visa: VisaIcon,
  mastercard: MastercardIcon,
  amex: AmexIcon,
  oney: OneyIcon,
  paypal: PaypalIcon,
  apple_pay: ApplePayIcon,
  google_pay: GooglePayIcon,
  klarna: KlarnaIcon,
}

export function PaymentMethodBrandIcon({
  brand,
  className,
}: {
  brand: PaymentMethodBrandId
  className?: string
}) {
  const Icon = ICONS[brand]
  return <Icon className={cn("h-full w-full", className)} />
}
