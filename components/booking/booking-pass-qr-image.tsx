type Props = {
  dataUrl: string
  tokenPreview: string
  qrAlt: string
}

export function BookingPassQrImage({ dataUrl, tokenPreview, qrAlt }: Props) {
  return (
    <div className="mt-6 flex flex-col items-center gap-2 rounded-2xl border border-dashed border-cyan-400/30 bg-cyan-950/30 p-5">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={dataUrl}
        alt={qrAlt}
        width={280}
        height={280}
        className="rounded-xl bg-[#050810] p-2 ring-1 ring-cyan-400/20"
      />
      <p className="font-mono text-xs tracking-widest text-cyan-200/90">{tokenPreview}</p>
    </div>
  )
}
