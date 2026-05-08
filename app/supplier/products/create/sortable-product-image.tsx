"use client"

import { useSortable } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"

export function SortableProductImage(props: {
  id: string
  src: string
  isCover?: boolean
  onRemove: () => void
}) {
  const { id, src, isCover, onRemove } = props
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 20 : undefined,
  } satisfies React.CSSProperties

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="aspect-square bg-gray-100 rounded-lg relative group overflow-hidden border border-gray-200 touch-none select-none"
    >
      <img src={src} alt="" className="w-full h-full object-cover rounded-lg pointer-events-none" draggable={false} />

      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          onRemove()
        }}
        className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs z-30 shadow"
        aria-label="Supprimer cette image"
        onPointerDown={(e) => e.stopPropagation()}
      >
        ×
      </button>

      {isCover ? (
        <div className="absolute top-2 left-2 rounded bg-black/60 text-white px-2 py-0.5 text-[11px] font-medium z-20 pointer-events-none">
          Couverture
        </div>
      ) : null}

      <div {...attributes} {...listeners} className="absolute inset-0 bg-transparent cursor-grab active:cursor-grabbing z-10" />
    </div>
  )
}
