# Vercel build machine: why Enhanced, how to switch, how to verify

## Measured facts (28/11/2026, local reproduction on 2 vCPU / 7.8 GB)

- `next build` on `main` (8b2488846) is killed by the kernel for lack of memory (OOM kill). The peak is about **6.0–6.3 GB**, during the Turbopack compile, after 90–172 s.
- **The PRs are not the cause**: they add at most 0.8% of compiled code.
- **No free knob helps.** Five configurations were measured and all were killed: memory eviction, a 3 GB heap, a single thread, webpack, webpack with a 4 GB heap.
- **The Vercel timings match.** The 11 builds without the migration failed after 145–214 s, and #35/#37 after 153–165 s once past the schema check.
- **Not demonstrated**: the exact text of the Vercel stop line, because no build log has been read. The chronology (Turbo until 04/11, Standard since 16/11) is a correlation, not a proof.

## Machines (vercel.com/docs/builds/managing-builds, prices at $0.0035 per vCPU-minute)

| Machine | vCPU | Memory | $/min | Verdict |
|---|---|---|---|---|
| Standard (current) | 4 | 8 GB | 0.014 | insufficient (measured) |
| **Enhanced** | 8 | 16 GB | 0.028 | **recommended**: about 2.5× the measured peak |
| Turbo | 30 | 60 GB | 0.105 | oversized |

**Estimated cost**: about $0.25–0.40 per build (9–14 min, **estimated**, not measured), so about $10–16 per month for about 40 builds.

## Switching (owner: a paid setting)

1. Vercel → Team **Settings → Build and Deployment → Build Machines** → choose **Enhanced**, fixed (not Elastic, which climbed to Turbo on its own in October).
2. **Optional, free**: Project **Settings → Environment Variables**: `VERCEL_BUILD_SYSTEM_REPORT=1`, **Preview** environment only. Vercel then adds a memory and disk report to every build log.
3. The budgets already set ($20 overall, $10 builds) stay in place: they will warn if spending goes up.

## Verification once it is switched (Claude, without production)

- **Reference build = the Preview of #30.** It is `main` plus 59 lines of scripts. A build of `main` itself is a production deployment, so it needs separate approval.
- **One build is enough**, with no repeated identical builds.
- **Expected in the log**:
  - `[build] machine: 8 vCPU, memory limit 16…` (the line added by #38);
  - `next build finished`;
  - no `KILLED`.
- **To report**: duration, peak memory, and any new errors. `main` has not finished a build since 04/11 and 25 commits have landed since, so errors may come to light.
- **Then**: the Previews of #35/#37 must pass the schema check (declared migration) **and** compile.

## If it still fails on Enhanced

- The `[build]` line gives the peak against 16 GB.
- If the peak goes above about 14 GB, the next step is to cut the module graph: heavy client-side dependencies (onnxruntime-web, @imgly/background-removal), and dynamic imports on large pages.
