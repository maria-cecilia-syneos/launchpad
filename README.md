# LaunchPad

LaunchPad is the SHTS application foundation. It was bootstrapped with Next.js App Router, TypeScript, Tailwind CSS, and shadcn-compatible configuration.

## Getting Started

Install dependencies:

```bash
pnpm install
```

Run the development server:

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the foundation page.

## Verification

Run the baseline verification suite before handing off story work:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm test:e2e
```

If Playwright browsers are not installed locally, run:

```bash
pnpm exec playwright install chromium
```

## Structure

Application code lives under `src/`:

- `src/app/**` for App Router routes, layouts, and route-level composition.
- `src/components/ui/**` for shadcn primitives.
- `src/components/launchpad/**` for LaunchPad-specific shared components.
- `src/domain/**` for domain contracts and pure rules.
- `src/server/**` for future server-only services, repositories, integrations, and workers.

Do not place enterprise connector or ingestion business logic inside UI routes.

## Environment

Copy `.env.example` when local environment variables are needed. Do not commit real secrets.
