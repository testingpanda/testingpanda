# Geneva Tax Declaration Assistant (MVP)

A secure, AI-assisted web application for preparing a **Geneva, Switzerland**
personal tax declaration from uploaded documents. Users upload their previous
declaration, this year's blank declaration, and supporting documents; the
system classifies and extracts data, the user reviews and confirms every
value, and the system produces a best-effort completed declaration PDF plus a
full review/audit package.

**This tool provides AI-assisted preparation, not certified tax advice.**
Every value in the workflow is presented as a proposal that the user must
confirm, edit, reject, or mark not applicable/missing before anything can be
finalized. Nothing is ever silently finalized.

## Product principles

For every important value, the system always answers three questions:
**what is proposed, where did it come from, and has the user confirmed it?**

- Item statuses: `extracted → needs_review → confirmed | edited_confirmed | rejected | not_applicable | missing` (or `unresolved` if nothing was found).
- Case statuses: `created → documents_uploaded → extraction_in_progress → extraction_completed → user_review_in_progress → validation_blocked | ready_for_generation → generated → finalized` (or `deleted`).
- The **generation gate**: the "Generate final package" action is server-side blocked until every mandatory item is resolved and no blocking validation issues remain — see `src/lib/validation/engine.ts::checkGenerationGate`.
- The **final declaration screen** requires five explicit checkboxes (reviewed everything, understands this isn't certified advice, remains responsible, confirms completeness, wants to generate) before generation is even attempted — enforced server-side with `z.literal(true)`, not just in the UI.

## Tech stack

- **Next.js 14** (App Router) + TypeScript, Tailwind CSS
- **PostgreSQL + Prisma**
- Custom cookie/JWT session auth (`jose`) + bcrypt password hashing — no third-party auth SaaS dependency
- **Storage abstraction**: local filesystem (dev) or S3-compatible object storage (prod), all files AES-256-GCM encrypted before they touch disk/bucket
- **LLM provider abstraction**: OpenAI, Anthropic, or a fully offline deterministic **mock** provider (default) — see `src/lib/llm`
- **PDF pipeline**: `pdf-parse` (text extraction), `pdf-lib` (AcroForm filling, overlay, generated reports), `tesseract.js` (optional real OCR) with a safe stub default
- Vitest for tests, Docker Compose for local dev

## Deploying to Vercel

This app deploys like any Next.js app — **connect the GitHub repo in the
Vercel dashboard**, you don't need to paste code anywhere. Vercel builds and
deploys directly from the branch. Two infrastructure pieces aren't provided
by Vercel itself and you need to provision them first:

1. **A PostgreSQL database** — Vercel Postgres, [Neon](https://neon.tech), or [Supabase](https://supabase.com) all work. Copy the connection string.
2. **An S3-compatible bucket** — AWS S3, Cloudflare R2, or Backblaze B2. Vercel's serverless filesystem is ephemeral/read-only, so `STORAGE_DRIVER=local` is refused at boot when `NODE_ENV=production` (see `src/lib/env.ts`) — you must use `s3`.

### Steps

1. Push this repo to GitHub (already done if you're reading this from the pushed branch) and import it in [vercel.com/new](https://vercel.com/new).
2. In **Project Settings → Build & Development Settings**, override the Build Command to:
   ```
   npm run vercel-build
   ```
   (this runs `prisma generate && prisma migrate deploy && next build`, applying migrations on every deploy — fine for a single-environment MVP deployment).
3. In **Project Settings → Environment Variables**, add:

   | Variable | Value |
   |---|---|
   | `DATABASE_URL` | your Postgres connection string |
   | `APP_ENCRYPTION_KEY` | `openssl rand -base64 32` |
   | `SESSION_SECRET` | `openssl rand -base64 32` |
   | `NODE_ENV` | `production` |
   | `APP_URL` | your Vercel deployment URL, e.g. `https://your-app.vercel.app` |
   | `STORAGE_DRIVER` | `s3` |
   | `STORAGE_S3_BUCKET` | your bucket name |
   | `STORAGE_S3_REGION` | e.g. `us-east-1` (or your R2 region) |
   | `STORAGE_S3_ENDPOINT` | only needed for R2/B2/non-AWS — your provider's S3 endpoint URL |
   | `STORAGE_S3_ACCESS_KEY_ID` / `STORAGE_S3_SECRET_ACCESS_KEY` | your bucket credentials |
   | `STORAGE_S3_FORCE_PATH_STYLE` | `true` for R2/B2, `false` for AWS S3 |
   | `LLM_PROVIDER` | `mock` to start (free, no key needed), or `openai`/`anthropic` with the matching API key var |
   | `OCR_PROVIDER` | `stub` (safe default) |
   | `MALWARE_SCAN_PROVIDER` | `stub` (safe default — see README "Production hardening TODOs" for wiring real ClamAV) |
   | `MAX_UPLOAD_SIZE_MB` | keep ≤ 4 on Vercel's Hobby plan — see note below |
   | `SEED_DEMO_MODE` | `false` (don't auto-seed a demo account in production) |

4. Deploy. On first deploy, `vercel-build` applies the Prisma migration to your database automatically.
5. (Optional) Run `npm run seed` locally against the production `DATABASE_URL`/storage config if you want a demo account — not recommended for a real production database.

### Vercel-specific limits to know about

- **Request body size**: Vercel serverless functions cap request bodies (4.5 MB on Hobby, higher on Pro). The document upload endpoint (`/api/cases/[id]/documents`) will reject larger files with a platform-level error before your app even sees them — keep `MAX_UPLOAD_SIZE_MB` under your plan's limit, or upgrade to Pro for larger uploads.
- **Function duration**: extraction and PDF generation run synchronously in the request. Both routes now set `export const maxDuration = 60` — this requires a Pro plan or higher; Hobby is capped at 10s and large/scanned documents may time out. If that happens in practice, move those two routes to a background job (the `src/lib/jobs/queue.ts` interface is already shaped for swapping in BullMQ + Redis, or a Vercel Queue/Inngest-style approach).
- **Cold starts**: the mock LLM/OCR providers are fast; real OpenAI/Anthropic/tesseract calls add latency on top of the above.

## Quick start (Docker)

```bash
cp .env.example .env
# generate real secrets:
#   openssl rand -base64 32   -> APP_ENCRYPTION_KEY
#   openssl rand -base64 32   -> SESSION_SECRET
docker compose up --build
# in another shell, once the app container is up:
docker compose exec app npx prisma migrate deploy
docker compose exec app npm run seed
```

Visit http://localhost:3000 and log in with the seeded demo account
(`demo@example.com` / `DemoPassword123!` by default — see `.env.example`).

## Quick start (local, no Docker)

Requires Node 20+, and a local PostgreSQL instance.

```bash
npm install
cp .env.example .env      # fill in DATABASE_URL, APP_ENCRYPTION_KEY, SESSION_SECRET
npx prisma migrate dev
npm run seed               # optional: creates a demo user + fully populated demo tax case
npm run dev
```

## Environment variables

See `.env.example` for the full, commented list. Everything is validated at
boot by `src/lib/env.ts` — the app refuses to start with missing or malformed
configuration rather than failing unpredictably later. Key switches:

| Variable | Purpose |
|---|---|
| `STORAGE_DRIVER` | `local` (dev) or `s3` (prod, encrypted object storage) |
| `LLM_PROVIDER` | `mock` (default, offline/deterministic), `openai`, or `anthropic` |
| `OCR_PROVIDER` | `stub` (default, flags for manual review) or `tesseract` (real OCR for image uploads) |
| `MALWARE_SCAN_PROVIDER` | `stub` (dev default) or `clamav` |
| `SEED_DEMO_MODE` | whether `npm run seed` creates the demo account/case |

## Workflow

1. Register / log in.
2. Create a new tax case (Geneva only in this MVP; canton is a first-class field for future expansion).
3. Upload: previous year's declaration, this year's blank declaration, and any number of supporting documents (salary certificates, bank statements, 3rd pillar, insurance, mortgage, childcare, medical, donations, securities, real estate, etc.).
4. The system classifies each supporting document and extracts structured data per document type (strict Zod schema per type — see `src/lib/extraction/schemas.ts`).
5. **Extraction review**: every atomic extracted value, with its source document, page, evidence excerpt, and confidence, confirmed/edited/rejected/marked not-applicable/missing one by one.
6. **Section-by-section review**: the same values mapped onto Geneva declaration sections (income, bank accounts, 3rd pillar, deductions, etc.), including a way to explicitly resolve a required section that has nothing to declare.
7. **Missing information**: automatic alerts when something declared last year (3rd pillar, mortgage, childcare, donations) has no matching document this year.
8. **Final validation checklist**: the generation gate — shows exactly what's still blocking, links back to the right review page.
9. **Final declaration**: five mandatory checkboxes, enforced server-side.
10. **Generate**: best-effort PDF fill (AcroForm → overlay if coordinates are configured → manual-entry report, in that priority order — see "PDF filling strategy" below), plus five supporting reports, all zipped.
11. **Download**: a short-lived signed download token exchanges for the decrypted file; the case is marked `finalized` on first successful download.
12. **Settings**: permanently delete a case and everything under it (files, extracted data, confirmations) at any time.

## PDF filling strategy

Implemented in `src/lib/pdf/package.ts`, in this priority order, and it never
fakes a result it isn't confident about:

1. If the uploaded current-year blank declaration has real AcroForm fields, matched declaration values are filled directly into those fields (fields are matched by declaration code substring against the government form's own field names — anything that doesn't match is reported, not silently dropped).
2. If explicit overlay coordinates are configured for the canton/form version (`src/lib/taxSections/geneva.ts`, currently empty — filling this in requires analyzing a real Geneva PDF template), values are drawn at those exact positions.
3. Otherwise, the system does **not** guess field positions. It generates a clear, complete `tax_review_summary.pdf` listing every confirmed value by section, explicitly labeled "manual transcription required," so the user can complete the official form by hand with full information in front of them.

The final package always contains all six files, even in the manual-entry
case: `completed_tax_declaration.pdf`, `tax_review_summary.pdf`,
`supporting_documents_index.pdf`, `assumptions_and_warnings.pdf`,
`missing_items_checklist.pdf`, `audit_trail.pdf`.

## Security

- Passwords hashed with bcrypt (cost 12). Sessions are httpOnly, signed JWT cookies (`jose`), 8h TTL.
- All uploaded files and sensitive DB columns (extracted values, evidence excerpts, confirmation history) are AES-256-GCM encrypted; the master key never touches the database.
- Raw storage URLs are never sent to the client — downloads go through short-lived, app-issued signed tokens that are exchanged server-side for decrypted content (`src/lib/security/downloadToken.ts`).
- CSRF: double-submit cookie, enforced in `src/middleware.ts` for every state-changing `/api` request.
- Rate limiting on login/register/upload endpoints (in-memory; documented as swap-to-Redis for multi-instance deployments).
- File upload validation: MIME allowlist + magic-byte verification + executable-extension denylist + configurable size limit; malware scan abstraction (stub in dev, real ClamAV `INSTREAM` client included for production).
- Role-based access control (`USER` / `ADMIN`); admin views never expose decrypted tax values.
- Audit log for every upload, classification, extraction, confirmation, validation run, PDF generation, download, and deletion — metadata is sanitized to exclude anything resembling raw tax/salary/bank/health/PII data.
- Full data deletion: deleting a case removes every file from storage and every DB row under it; the audit trail entry for the deletion itself survives (with the case ID nulled, snapshot preserved) for compliance.

## Testing

```bash
npm run test        # vitest — requires a reachable PostgreSQL database (DATABASE_URL)
npm run typecheck
npm run build
```

Tests cover: document classification, per-document-type Zod schema
validation, extraction parsing (deterministic mock engine + end-to-end),
the validation engine's rules, the confirmation state machine, PDF
form-fill/fallback logic, access control, and the full data-deletion flow.
Several suites run against a real database rather than a mock — set
`DATABASE_URL` to a disposable test database before running `npm run test`.

There's also `scripts/smoke-test.mjs`, a standalone script that exercises the
entire workflow (register → upload → review → validate → final declaration →
generate → download → delete) against a running `npm run dev` server over
real HTTP, useful for a quick end-to-end sanity check after a change.

## Data model

See `prisma/schema.prisma`. Core entities: `User`, `TaxCase`,
`UploadedDocument`, `DocumentPage`, `ExtractedField`, `TaxSection`,
`TaxFieldMapping`, `UserConfirmation`, `GeneratedPDF`, `AuditLog`,
`MissingDocument`, `Assumption`, `ValidationIssue`. `Canton` is a first-class
enum/column throughout specifically so a second canton can be added later by
adding a new `CantonConfig` (see `src/lib/taxSections/geneva.ts`) rather than
a schema migration.

## Production hardening TODOs

This is an MVP. Before real production use:

- Replace the illustrative Geneva declaration field codes in `src/lib/taxSections/geneva.ts` with verified codes from the actual current-year form, and populate `overlayCoordinates` from a real template analysis.
- Move the in-memory rate limiter to Redis for multi-instance deployments.
- Wire `MALWARE_SCAN_PROVIDER=clamav` to a real ClamAV daemon (client is implemented; the daemon isn't provisioned here).
- Add a real PDF-to-image rasterization step so scanned **PDF** pages (not just directly-uploaded images) can go through OCR (`src/lib/pdf/ocr.ts` documents this gap).
- Move the background job queue (`src/lib/jobs/queue.ts`) to BullMQ + Redis if extraction/generation needs to run outside the request/response cycle.
- Consider a KMS-backed encryption key instead of a single `APP_ENCRYPTION_KEY` env var.
- Add structured monitoring/alerting around the audit log and validation engine.

## Out of scope (by design)

No marketing pages, no payment system, no government submission integration,
no multi-canton support beyond the architecture placeholder, no mobile app,
no CRM, and no automated legal/tax advice claims.
