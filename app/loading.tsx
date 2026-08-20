/** Inline styles only — shown during first webpack compile before Tailwind CSS is ready. */
export default function RootLoading() {
  return (
    <>
      <style
        dangerouslySetInnerHTML={{
          __html: `
            .affisell-root-loading {
              min-height: 100dvh;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              gap: 1rem;
              font-family: Inter, system-ui, sans-serif;
              background: linear-gradient(180deg, #fafafc 0%, #f4f4f5 100%);
              color: #18181b;
            }
            .affisell-root-loading__bar {
              width: min(18rem, 70vw);
              height: 0.35rem;
              border-radius: 999px;
              background: #e4e4e7;
              overflow: hidden;
            }
            .affisell-root-loading__bar > span {
              display: block;
              width: 40%;
              height: 100%;
              border-radius: inherit;
              background: linear-gradient(90deg, #7c3aed, #2563eb);
              animation: affisell-root-loading-slide 1.2s ease-in-out infinite alternate;
            }
            @keyframes affisell-root-loading-slide {
              from { transform: translateX(-20%); }
              to { transform: translateX(220%); }
            }
          `,
        }}
      />
      <div className="affisell-root-loading" role="status" aria-live="polite" aria-busy="true">
        <p style={{ fontSize: "0.875rem", fontWeight: 600 }}>Affisell</p>
        <div className="affisell-root-loading__bar" aria-hidden>
          <span />
        </div>
        <p style={{ fontSize: "0.75rem", color: "#71717a" }}>Chargement du catalogue…</p>
      </div>
    </>
  )
}
