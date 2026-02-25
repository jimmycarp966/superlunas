# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Cotizador (quotation calculator) for **Lunas Confort** — a Next.js 15 App Router application with role-based access for Vendors and Admins. Replaces a Google Apps Script-based system. Designed for Vercel deployment with a **stateless, no-database architecture**.

## Commands

```bash
npm run dev          # Development server (localhost:3000)
npm run build        # Production build
npm run lint         # ESLint checks
npx vitest           # Run unit tests
npx vitest run       # Unit tests (CI mode, no watch)
npx playwright test  # E2E tests (requires dev server running or auto-starts it)
```

No `type-check` script exists — use `npx tsc --noEmit` directly.

## Architecture

### Authentication & Routing

`middleware.ts` intercepts all requests before they reach pages/routes:
- Cookie: `lunas_confort_session` (httpOnly, HS256 JWT, 2h TTL)
- `/cotizador` → vendor or admin role required
- `/config/panel` → admin role only
- Unauthenticated users redirect to `/` (root login page)
- Authenticated users visiting `/` or `/config` are redirected to their respective dashboard

`lib/auth.ts` handles JWT creation and verification using `jose`.

### No-Database Data Layer

All persistent data lives in Node.js global variables (in-memory):

- **`global.catalogCache`** — product catalog parsed from PDF or Excel. Populated on first API request, TTL-controlled via `CACHE_TTL_SECONDS`. Reconstitutes automatically on cold start from `SOURCE_FILE_URL` or local file.
- **`global.appSettings`** — rounding preferences and available product lists (e.g., `["local", "valles"]`)
- **`global.appPlans`** — payment plans with weeks, interest rates, and badges

`lib/sourceLoader.ts` parses both PDF (via `pdf2json`) and Excel (via `xlsx`). PDF parsing groups text by Y-coordinate to reconstruct tabular rows.

### Key Business Logic

**Price normalization** (`lib/sourceLoader.ts`): handles ambiguous formats like `$ 1.234,56` vs `1,234.56` using a heuristic based on the 3rd character from the end.

**Quota calculation**:
```
total  = subtotal × (1 + tasaPorcentaje/100)
saldo  = max(0, total − anticipo)
cuota  = semanas > 0 ? saldo / semanas : saldo
```

### API Routes (`app/api/`)

| Endpoint | Method | Auth Required |
|----------|--------|---------------|
| `/api/auth/login` | POST | None |
| `/api/auth/logout` | POST | None |
| `/api/products` | GET | Vendor/Admin |
| `/api/settings` | GET/PUT | GET: None, PUT: Admin |
| `/api/plans` | GET/PUT | GET: None, PUT: Admin |
| `/api/source/refresh` | POST | Admin |
| `/api/source/upload` | POST | Admin |

### Path Alias

`@/*` maps to the project root (`./`), not `./src/`. All imports use this alias.

## Environment Variables

```env
VENDOR_PASSWORD         # Vendor login password
ADMIN_PASSWORD          # Admin login password
JWT_SECRET              # JWT signing secret (required)
SOURCE_FILE_TYPE        # "pdf" or "excel"
SOURCE_FILE_URL         # Remote URL for product catalog (optional)
SOURCE_AUTH_TOKEN       # Bearer token for SOURCE_FILE_URL (optional)
CACHE_TTL_SECONDS       # Cache TTL in seconds (default: 600)
NEXT_PUBLIC_APP_NAME    # "Lunas Confort"
```

## Testing

- **Unit tests** (`tests/unit/`): Vitest — cover price normalization and quota calculation
- **E2E tests** (`tests/e2e/`): Playwright Chromium — cover login flow and role-based route protection

To run a single unit test file:
```bash
npx vitest run tests/unit/calculator.test.ts
```

## Vercel Deployment Notes

The in-memory cache (`global.*`) resets on each cold start. For consistent behavior across serverless instances, host the product catalog file at a stable URL set in `SOURCE_FILE_URL`. Without it, each instance independently re-fetches from the local bundled file on first request.
