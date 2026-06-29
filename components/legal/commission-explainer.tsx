import {
  formatBreakdownAmount,
  type OrderCommissionView,
} from "@/lib/order-commission-breakdown"
import { cn } from "@/lib/utils"

type Props = {
  view: OrderCommissionView
  className?: string
}

export function CommissionExplainer({ view, className }: Props) {
  return (
    <section
      className={cn(
        "rounded-xl border border-zinc-200 bg-zinc-50/80 p-4 dark:border-zinc-800 dark:bg-zinc-900/50",
        className
      )}
      aria-label="Répartition des montants"
    >
      <h3 className="text-sm font-semibold text-zinc-900 dark:text-white">{view.headline}</h3>
      <p className="mt-1 text-xs text-zinc-500">{view.footnote}</p>
      <table className="mt-4 w-full text-sm">
        <tbody>
          {view.rows.map((row) => (
            <tr key={row.key} className="border-b border-zinc-200/80 last:border-0 dark:border-zinc-800">
              <td className="py-2 pr-4 text-zinc-600 dark:text-zinc-400">
                {row.label}
                {row.hint ? (
                  <span className="mt-0.5 block text-[11px] text-zinc-400 dark:text-zinc-500">{row.hint}</span>
                ) : null}
              </td>
              <td className="py-2 text-right font-medium tabular-nums text-zinc-900 dark:text-zinc-100">
                {formatBreakdownAmount(row.amountCents)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}
