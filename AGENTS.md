# Repository Guidelines

## Project Structure & Module Organization
- `app/`: Next.js App Router pages, layouts, and feature screens.
- `app/api/**/route.ts`: backend endpoints for auth, products, plans, settings, clients, source refresh/upload, and registrations.
- `app/cotizador` and `app/config/panel`: main vendor and admin interfaces.
- `lib/`: shared logic and integrations (`sourceLoader.ts`, `settings.ts`, `supabase.ts`, `types.ts`).
- `tests/unit`: Vitest business-logic tests.
- `tests/e2e`: Playwright end-to-end flows.
- `public/`: static assets served directly.

## Build, Test, and Development Commands
- `npm install`: install dependencies.
- `npm run dev`: start local development server at `http://localhost:3000`.
- `npm run build`: compile production build.
- `npm run start`: run the production server.
- `npm run lint`: run ESLint (Next.js core-web-vitals + TypeScript rules).
- `npx vitest`: run unit tests from `tests/unit`.
- `npx playwright test`: run E2E tests from `tests/e2e` (Playwright config launches `npm run dev`).

## Coding Style & Naming Conventions
- Language: TypeScript with `strict` mode enabled.
- Match existing TS/TSX style: 4-space indentation, semicolons, double quotes.
- Use `PascalCase` for React components/types and `camelCase` for variables, functions, and hooks.
- Keep API handlers in `route.ts` under `app/api/<feature>/`.
- Reuse helpers from `lib/` for parsing, auth, and settings logic instead of duplicating code.

## Testing Guidelines
- Unit tests: `*.test.ts` naming (example: `tests/unit/calculator.test.ts`).
- E2E tests: `*.spec.ts` naming (example: `tests/e2e/cotizador.spec.ts`).
- For feature changes, add/update tests around pricing logic, auth redirects, and cotizador/admin flows.
- No enforced coverage threshold currently; prioritize meaningful assertions on changed behavior.

## Commit & Pull Request Guidelines
- Follow repo history style: `feat: ...`, `fix: ...` with concise, imperative summaries.
- Keep each commit focused on one logical change.
- PRs should include scope/rationale, linked issue or task, and test evidence (`npm run lint`, `npx vitest`, `npx playwright test` when applicable).
- Include screenshots or short recordings for UI changes in `/cotizador` or `/config/panel`.

## Security & Configuration Tips
- Use `.env.example` as template for `.env.local`.
- Never commit secrets (`JWT_SECRET`, passwords, Supabase keys).
- Prefer `SOURCE_FILE_URL` for stable production catalog loading in serverless deployments.
