# PROJECT BRAIN — carestino-giftcard
> Router for this project's context. Read it before any substantive work.
> **It copies nothing.** Every fact here either lives here because no other file holds it, or is a
> pointer to the file that owns it — open that file. Do not act on a paraphrase, and if this file
> and a source file disagree, **the source file wins** and this one is stale.
> Do NOT invent conventions, file paths, APIs, or commands — if it is not here, not in a routed
> file, and not verifiable in the code, say so instead of guessing.
> Absorbed at `8fa3d25` on 2026-10-05.
> Drift check: `git log --oneline 8fa3d25..HEAD`
> — if that prints more than a handful of commits, treat §3-§5 as suspect and re-run /memorizar-proyecto.

## 1. What this is
Internal Next.js tool for **Carestino Bebés Felices (Santa Fe)**: an operator logs in, fills a form,
and gets a branded gift card as PDF and as an MP4 (for WhatsApp), each with a unique `CARE-XXXX-XXXX`
code and a QR pointing at a public verification page. The store scans that QR to check validity and
marks the card as used, capturing who redeemed it (name + DNI). In production on `main`; single admin
user, no public signup.

## 2. Where the truth lives

| Ask about | Open | What it holds |
|---|---|---|
| **Why anything is the way it is** | `MEMORY.md` (since 2026-10-05: `D-`, `G-`, `TD-`, `OQ-` entries) + `git log` for everything earlier (messages are descriptive, Spanish, conventional-commit prefixed) | Decisions before 2026-10-05 live only in commit messages and in this file's §5/§7. **Read `MEMORY.md` IN FULL before touching an area it covers.** `FASES_IMPLEMENTACION.md` is NOT a log — it is the original 2026 plan, largely superseded (see §5). |
| Session history and current state | `WORKLOG.md` | ESTADO (overwritten each `/cerrar`) + REGISTRO (append-only, one entry per chat). |
| Original brief / product intent | `FASES_IMPLEMENTACION.md` (238 lines) | The 7-phase plan, the options evaluated for video, and 4 "decisiones pendientes". **Read it as history, not as spec** — most of it was decided differently. §5 lists every divergence. |
| Domain content shown on the card | `src/components/GiftCard.tsx` | Phone, address, terms, brand color/font constants, and the exact card geometry. Hardcoded there, not in config. |
| Design tokens, palette, type | `src/app/globals.css` (27 lines) + `src/app/layout.tsx` | CSS vars for background/foreground/brand orange/card bg, Montserrat mounted as `--font-montserrat`, Tailwind v4 via `@import "tailwindcss"` + `@theme inline`. |
| DB schema and enum | `prisma/schema.prisma` + `prisma.config.ts` | The single `GiftCard` model and `GiftCardStatus`. `prisma.config.ts` declares a `prisma/migrations` path that **does not exist** (see §7). |
| Auth / route protection | `src/proxy.ts` | Next 16 proxy convention (not `middleware.ts`). Cookie `session` compared against `SESSION_SECRET`; `PUBLIC_PATHS` whitelist; matcher covers everything else. |
| Dev server for the browser preview | `.claude/launch.json` (untracked) | One config, `carestino-giftcard` → `npm run dev` on port 3000. |
| Env var names | `.env.local` (local only, gitignored) | `DATABASE_URL`, `ADMIN_USERNAME`, `ADMIN_PASSWORD`, `SESSION_SECRET`, `NEXT_PUBLIC_SITE_URL`. **No `.env.example` exists and none is to be created.** |
| Stack versions, scripts, deps | `package.json` + `package-lock.json` | npm. Note: `lint` and `postinstall` are the only non-obvious scripts. |
| Where the data lives | Neon project `carestino-giftcard` (`jolly-smoke-80453382`), org "Mateo", Postgres 17, `us-east-1`. Connection string in `.env.local` and in Vercel's env vars | Migrated off Supabase on 2026-08-24 (see §7). There are no workflows in this repo any more. |
| What is happening right now | `git log --oneline -15`, `git status --short` | Branch, in-flight work, uncommitted tree. Always current — never mirrored here. |

## 3. Code map <!-- owned here -->
```
src/
├── app/
│   ├── page.tsx             1207 ln — THE app: form + live preview + PDF/MP4 download + card list + delete
│   │                                  + amber DB-status banner + "sin guardar" pending queue
│   ├── admin/page.tsx        261 ln — read-only-ish table: filters, search, mark as used
│   ├── scan/page.tsx         383 ln — html5-qrcode camera flow, redeem with name + DNI
│   ├── verify/[code]/page.tsx 176 ln — PUBLIC verification page, the QR target
│   ├── login/page.tsx        116 ln
│   ├── api/auth/{login,logout}/route.ts
│   ├── api/giftcards/route.ts          GET (findMany) · POST (create; 409 on code collision)
│   └── api/giftcards/[code]/route.ts   GET (findUnique) · PATCH (update) · DELETE
│   └── api/health/route.ts             GET `SELECT 1`, 2 tries, maxDuration 30, 503 when down
├── components/GiftCard.tsx   378 ln — the card itself, forwardRef, inline styles
├── lib/{prisma,utils,generateVideo}.ts   prisma.ts = PrismaClient over @prisma/adapter-pg
└── proxy.ts                  auth gate
```
Three structural facts the tree does not show:
- **`/` is not a landing page.** It is the operator's generator *and* dashboard, and it is behind auth like everything else. `/admin` is a second, narrower view over the same data — the two overlap and are not a hierarchy.
- **`verify/[code]/page.tsx` is the only server component and the only public route** (it is in `PUBLIC_PATHS`, see §7). It queries Prisma directly instead of going through `/api`.
- **No shared UI layer.** No `components/ui`, no index barrels, no `cn()`. `GiftCard.tsx` is the only reusable component; every page writes its own Tailwind.

## 4. Conventions inferred from the code <!-- owned here -->
- **Everything is Spanish** — UI copy, comments, commit messages, error strings (`"Error obteniendo gift cards"`). Identifiers and DB columns are English camelCase (`recipientName`, `redeemedByDni`). Keep that split.
- **Semicolons, double quotes, 2-space indent, trailing commas.** Prettier-shaped, no config file.
- **File order in a client page:** `"use client"` → imports (React/Next, libs, then `@/`) → local `interface` → SCREAMING_SNAKE const maps (`STATUS_LABEL`, `STATUS_COLOR`) → helper functions → `export default function`.
- **Imports always via `@/`** (`tsconfig`: `@/* → ./src/*`). No deep relative paths.
- **State is plain hooks.** `useState` + `useCallback` + `useRef`; no context, no react-query, no server actions. Fetching is client-side `fetch("/api/...")` then a `if (json.success)` branch.
- **API routes never throw.** Every handler is one `try/catch` returning `NextResponse.json({ success, data? , error? }, { status })`; `console.error("contexto:", error)` on the way out; 400 on missing fields.
- **Styling is inline Tailwind with literal hex** — `bg-[#f8f4ef]`, `text-[#ea7014]`, `border-[#ea7014]/30`. The CSS vars in `globals.css` exist but pages mostly bypass them. `GiftCard.tsx` is the exception: it uses **React `style` objects, not Tailwind**, because html2canvas/WebCodecs need computed inline styles.
- **String state machines** drive UI trees: `"idle" | "scanning" | "loading" | "result" | "error"`.
- **Destructive actions use native `confirm()`**; loading is disambiguated with `setActionLoading(code + action)`.
- **Comments are sparse and Spanish**, only where logic is non-obvious (JSDoc on the two `lib/utils.ts` helpers, the `notes` explaining each guard in `api/giftcards/route.ts`).
- **No tests exist.** There is no test runner installed; do not assume one.

## 5. Where the docs and the code disagree <!-- owned here, highest value -->
`FASES_IMPLEMENTACION.md` reads like a spec and is mostly stale. **The code wins on every row below.**
- Doc says **Next.js 14**; the project runs **Next 16.1.6 / React 19.2.3** with the `proxy.ts` convention (`fb6c242`).
- Doc's Fase 4 recommends **Remotion (server render)**; the code does **client-side WebCodecs + `mp4-muxer`** in `src/lib/generateVideo.ts` (`88bf864`). Remotion is not installed.
- Doc's Fase 5 prescribes **NextAuth + `@tanstack/react-table`**; neither is installed. Auth is a **hand-rolled cookie compared to `SESSION_SECRET`** in `src/proxy.ts`, and the tables are plain JSX.
- Doc's Fase 7 lists **`NEXTAUTH_SECRET` / `NEXTAUTH_URL`**; the real vars are `SESSION_SECRET`, `ADMIN_USERNAME`, `ADMIN_PASSWORD`, `NEXT_PUBLIC_SITE_URL`.
- Doc's schema and Fase 6 include **`CANCELLED`**; that status was **removed** (`e7852e6`). The enum is `ACTIVE | USED` only — do not reintroduce it.
- Doc's schema omits `isProduct`, `redeemedByName`, `redeemedByDni`; all three exist in `prisma/schema.prisma`.
- Doc's "Decisiones Pendientes de Confirmar" (4 open questions) are **all already answered by the code** — the file was never updated.
- `README.md` is the **untouched create-next-app default**. It describes nothing about this project; ignore it.

## 6. Commands
From `package.json` (npm, `package-lock.json`):
```bash
npm install        # runs postinstall -> prisma generate
npm run dev        # http://localhost:3000
npm run build
npm start
npm run lint       # eslint (flat config, eslint.config.mjs)
```
Schema changes: edit `prisma/schema.prisma`, then `npx prisma db push` + `npx prisma generate` — see §7 before reaching for `migrate`.

## 7. Landmines <!-- owned here -->
- **There are no migrations.** `prisma/migrations/` does not exist even though `prisma.config.ts` points at it, so schema history has been pushed, not migrated. Running `npx prisma migrate dev` on the production DB would try to baseline it — confirm with Mateo before any `migrate` command.
- **Issuing must never outrun the DB write.** `POST /api/giftcards` uses `create`, not `upsert`: same code + same data → `200` (idempotent retry), same code + different data → `409 CODE_COLLISION`. `src/app/page.tsx` refuses to generate the PDF/MP4 until it has a confirmed code, queues failed attempts in `localStorage`, and regenerates the security code after each issue. Undoing any of that brings back gift cards that exist on paper but not in the database — read the `notes` on `CARE-QJM5-NJ6Y` for what that cost.
- **`/verify` is in `PUBLIC_PATHS`** (`src/proxy.ts`) because it is the QR target and the customer scanning it has no session. Do not "tighten" the auth gate by removing it.
- **The database moved off Supabase on 2026-08-24, and the reason matters.** Supabase free paused the project after ~7 days idle and needed a MANUAL restore from its dashboard. A daily GitHub Action kept it warm until GitHub auto-disabled the schedule (`disabled_inactivity`) after 60 days without a push to the repo — the last push was 2026-06-07, the keepalive died 2026-08-07, the project paused about a week later, and nobody noticed until a customer could not redeem. Neon suspends the compute instead and **wakes itself on the next connection**, so no keepalive exists any more. Do not add one back.
- **The health check is a warning, never a gate** (`8fa3d25`). Neon's first connection after days idle takes ~8s to wake the compute (measured 7955ms). The old check declared the DB down on the first failure and disabled the issue buttons, so the system locked itself while the DB was merely waking — on 2026-09-10 the operator saw "LA BASE DE DATOS NO RESPONDE" with a healthy DB. Now `/api/health` tries twice (1.5s apart, `maxDuration = 30`), `checkDb` in `page.tsx` tries 3× (2s apart), and `dbStatus === "down"` only renders an amber banner. The real protection is `persistGiftCard`. Do not make the banner block issuing again.
- **`/api/health` is behind auth** — not in `PUBLIC_PATHS`; it only serves the logged-in generator screen.
- **Two other Neon projects are named after this client and are NOT this app**: `carestino-santafe-prod` (`spring-math-52167931`, Vercel org, live 24/7) and `carestino-santafe` (`dawn-resonance-79271674`) belong to a separate sales/register system (`sales`, `expenses`, `withdrawals`). Never point this app at them.
- **Video generation is browser-only** (WebCodecs). No fallback for unsupported browsers; it will simply fail.
- **`GiftCard.tsx` renders at a fixed 480px native / 380px preview with a `s = 0.79` scale factor.** Editing spacing there changes the exported PDF and MP4, not just the screen — check all three outputs after touching it.
- **`src/app/page.tsx` is 1207 lines** and owns generation, listing, download naming (`buildFileName` → `CARESTINO-GIFT-CARD-{DESTINATARIO}`) and deletion. Changes there ripple wide.
- **Never create `.env.example`** in this repo (standing rule from Mateo's global instructions).

## Manual notes
(none yet)
