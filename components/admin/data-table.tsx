"use client"

import { useSyncExternalStore } from "react"
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
} from "@tanstack/react-table"

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

const MOBILE_QUERY = "(max-width: 767px)"

function subscribeMobile(cb: () => void) {
  const mq = window.matchMedia(MOBILE_QUERY)
  mq.addEventListener("change", cb)
  return () => mq.removeEventListener("change", cb)
}

/** True below md. Server + first client render assume desktop (hydration-safe). */
function useIsMobile(): boolean {
  return useSyncExternalStore(
    subscribeMobile,
    () => window.matchMedia(MOBILE_QUERY).matches,
    () => false
  )
}

type DataTableProps<TData> = {
  data: TData[]
  columns: ColumnDef<TData, unknown>[]
  emptyMessage?: string
  /** Sans bordure externe (déjà dans un shell parent). */
  embedded?: boolean
  /** Below md, render each row as a card instead of a horizontally scrolling table. Default true. */
  mobileCards?: boolean
}

export function DataTable<TData>({
  data,
  columns,
  emptyMessage = "No results.",
  embedded = false,
  mobileCards = true,
}: DataTableProps<TData>) {
  const isMobile = useIsMobile()
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
  })

  if (mobileCards && isMobile) {
    const rows = table.getRowModel().rows
    if (rows.length === 0) {
      return (
        <div className="rounded-2xl border border-zinc-200 bg-white p-8 text-center text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900">
          {emptyMessage}
        </div>
      )
    }
    return (
      <ul className="space-y-3" role="list">
        {rows.map((row) => {
          const cells = row.getVisibleCells()
          const [first, ...rest] = cells
          return (
            <li
              key={row.id}
              className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
            >
              {first ? (
                <div className="min-w-0 break-words pb-2">
                  {flexRender(first.column.columnDef.cell, first.getContext())}
                </div>
              ) : null}
              <dl className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {rest.map((cell) => {
                  const header = cell.column.columnDef.header
                  const label = typeof header === "string" ? header : ""
                  return (
                    <div key={cell.id} className="flex items-start justify-between gap-4 py-2">
                      {label ? (
                        <dt className="shrink-0 pt-0.5 text-[11px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                          {label}
                        </dt>
                      ) : null}
                      <dd className={label ? "min-w-0 break-words text-right" : "min-w-0 flex-1 break-words"}>
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </dd>
                    </div>
                  )
                })}
              </dl>
            </li>
          )
        })}
      </ul>
    )
  }

  return (
    <div
      className={
        embedded
          ? "overflow-hidden rounded-2xl bg-white dark:bg-zinc-950"
          : "rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900"
      }
    >
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((hg) => (
            <TableRow key={hg.id}>
              {hg.headers.map((header) => (
                <TableHead key={header.id}>
                  {header.isPlaceholder
                    ? null
                    : flexRender(header.column.columnDef.header, header.getContext())}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={columns.length} className="h-24 text-center text-zinc-500">
                {emptyMessage}
              </TableCell>
            </TableRow>
          ) : (
            table.getRowModel().rows.map((row) => (
              <TableRow key={row.id}>
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  )
}
