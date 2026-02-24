# AGENTS.md

## Cursor Cloud specific instructions

### Project overview
Quaddra is a BPMN process management web app (monorepo, npm workspaces). See `README.md` for full docs.

### Services

| Service | Port | Command |
|---------|------|---------|
| Next.js web app (`apps/web`) | 3000 | `npm run dev` (from root, runs both) |
| Fastify API (`apps/api`) | 4000 | (started automatically with `npm run dev`) |
| PostgreSQL | 5432 | `sudo pg_ctlcluster 16 main start` |

### Non-obvious caveats

- **PostgreSQL must be started manually** before launching the dev servers: `sudo pg_ctlcluster 16 main start`
- **Database credentials**: local dev uses user `quaddra` / password `quaddra`, database `quaddra` at `localhost:5432`. The `.env.local` file at `apps/web/.env.local` contains `DATABASE_URL`.
- **Prisma 7 config** lives in `apps/web/prisma.config.ts` (not in `schema.prisma`). It reads `DATABASE_URL` from `.env.local`.
- **Prisma commands** must be run from the `apps/web` directory: `npx prisma generate`, `npx prisma migrate deploy`.
- **Without `GITHUB_TOKEN`**, the BPMN viewer returns 500 on `/api/bpmn/[slug]` because the GitHub API call throws before reaching the local-file fallback. Process listing still works (separate error handling). This is a known limitation without credentials.
- **No automated tests exist yet** — Jest is configured but there are no test files. Running `npm test -w apps/web` will exit with code 1 (use `--passWithNoTests` to avoid).
- **Lint**: `npm run lint -w apps/web` runs `next lint`.
- **Build**: `npm run build -w apps/api` (tsc) and `npm run build -w apps/web` (prisma generate + next build).
- **Supabase keys** in `.env.local` can be placeholder values for local dev — the app logs a warning but still works with a direct `DATABASE_URL`.
