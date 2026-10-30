# AGENTS.md

SIGICE backend: NestJS 11 + PostgreSQL 16 + TypeORM API for the SIGICE frontend (Universidad del Pacífico). Domain code, messages, and comments are Spanish — keep new code and user-facing errors in Spanish.

## Commands

- `npm ci`; `npm run start:dev` — Nest watch mode on `PORT` (default 3000). Requires a running Postgres and a `.env`.
- `npm run build` then `npm run start:prod` — `tsc -p tsconfig.build.json` to `dist/`; production runs with `NODE_ENV=production`.
- `npm run migrate:prod` — ejecuta el runner protegido ya compilado (`dist/migrate-guarded.js`). El `CMD` del `Dockerfile` y `railway.json` lo ejecutan con `MIGRATE_CONFIRM=YES` antes de `start:prod`.
- `npm test` — Jest (rootDir `src`, `*.spec.ts`). Unit specs need no DB; `src/test/integracion.spec.ts` needs Postgres and creates/truncates `intereses_db_test`.
- Single test: `npm test -- auth.service.spec` (Jest path pattern). Skip the DB suite: `npm test -- --testPathIgnorePatterns=integracion`.
- Local DB: `docker compose up -d postgres` (reads `.env`; DB on `localhost:5432`). `docker compose up -d --build` runs the API too.
- `npm run seed` / `npm run seed:prod` — create admin, topics, subjects, and demo data (`seed:prod` needs a prior build). In production strong `ADMIN_PASSWORD`/`ESTUDIANTE_PASSWORD` are mandatory and the demo student is created when `SEED_DEMO_STUDENT=true` or `ESTUDIANTE_PASSWORD` is explicitly provided (unless `SEED_DEMO_STUDENT=false`). Additionally, in production the app runs this seed automatically at startup when the configured `ADMIN_EMAIL` does not yet exist and `ADMIN_PASSWORD` is set.
- Migrations: `npm run migration:generate -- src/migrations/<Nombre>` then `npm run migration:run`; production may also use `npm run migration:run:guarded` with `MIGRATE_CONFIRM=YES`. TypeORM applies pending migrations on application start in every environment unless `DB_MIGRATIONS_RUN=false`.
- Node >= 20 required (Docker uses 22).

## Config and startup

- `.env` lives at the repo root (gitignored) and is also looked up at `../.env`. It holds DB/JWT/SSO/SMTP and login-crypto secrets — never commit or log it.
- Boot fails unless `JWT_SECRET` is >= 32 chars and not a sample value, and `LOGIN_CRYPTO_ACTIVE_KEY_ID` + `LOGIN_CRYPTO_KEYS_JSON` contain a valid PKCS#8 RSA key >= 3072 bits.
- `main.ts` sets the global prefix `api`, helmet, CORS from `FRONTEND_URL` (comma-separated) plus `localhost:4200`, Swagger at `/api/docs` (disable with `ENABLE_SWAGGER=false`), and health at `/api/health`.
- `ConfigModule` looks for `../.env` then `.env`; `data-source.ts` loads both for CLI/seed commands.
- `migrationsRun` applies pending migrations at startup in every environment (including production); set `DB_MIGRATIONS_RUN=false` to disable it and run them manually.

## API, auth and access

- Every HTTP route must be explicitly `@Public()` or `@Auth(...roles)`; `AccessGuard` denies and logs undecorated routes. Roles are `ESTUDIANTE` and `ADMIN`.
- Login is a two-step encrypted flow: `GET /auth/login-crypto` then `POST /auth/login` with an RSA-OAEP + AES-GCM envelope (`login-crypto.service.ts`); challenges are single-use and expire in 2 minutes.
- Passwords use Argon2id with OWASP parameters (`common/password.util.ts`); legacy bcrypt hashes are accepted and rehashed on login. Never log passwords or request bodies (see `log-seguro.ts`).
- Uploads: random 32-hex `jpg|png|webp` files in `UPLOADS_DIR` (default `./uploads`, gitignored except `.gitkeep`). The type is detected from the binary signature; `/uploads/*` is blocked and images are served by `GET /api/uploads/:nombre` with JWT plus per-resource access.
- The API serves the compiled Angular app if it finds `frontend/dist/app/browser` or `../frontend/dist/app/browser`; otherwise it is API-only (normal local dev).

## Database and migrations

- TypeORM uses `synchronize: false`; entities are listed explicitly in `app.module.ts` and `data-source.ts` — add new entities to both.
- Migrations are explicit classes under `src/migrations/`. A new migration must also be imported and added to the `migrations` array in `src/data-source.ts`, or CLI/seed/migration runs will not see it.
- Integration tests create their schema with `ds.synchronize()` in `intereses_db_test`; never point `TEST_DB_NAME` at a real DB (it must end in `_test`).

## Structure

- `src/common/` — global guards (access, JWT, roles), throttling, filters, redacted logging, validation, health.
- `src/config/` — JWT secret and migration policy.
- `src/modules/<feature>/` — controller, service, DTOs, entities, specs; `src/migrations/` — SQL migrations; `src/test/` — HTTP and DB integration specs.
- `src/seed.ts`, `src/migrate-guarded.ts`, `src/scripts/` — operational entrypoints.

## Gotchas

- Never run `migration:run` manually against production without `migration:run:guarded` + `MIGRATE_CONFIRM=YES`; the app already applies pending migrations on startup unless `DB_MIGRATIONS_RUN=false`.
- `tsconfig` has `strictNullChecks: false` and excludes specs from the build; don't assume strict TS.
- `.gitignore` covers `node_modules/`, `dist/`, `.env`, `coverage/`, and `uploads/*` (keeping `.gitkeep`).
- No lint or format script exists; `npm run build` and `npm test` are the checks.
- `DB_HOST` may be `postgres` for Docker Compose; when running Nest/TypeORM on the host, override it with `DB_HOST=localhost`.

<!-- BEGIN agent-context -->
## Contexto de arquitectura y registro

- Lee `AGENTS.md` completo antes de trabajar.
- Carga las skills aplicables de la sección 16 de `ARCHITECTURE_CONTEXT.md` (si están disponibles en tu entorno) y lee ese documento completo, contrastándolo con el código de las zonas que vayas a tocar.
- Sigue la misma arquitectura, capas, convenciones y patrones; no introduzcas estructuras, librerías ni estilos nuevos sin justificación y aprobación.
- Registra cada tarea en `AGENT_CHANGELOG.md` y actualiza `ARCHITECTURE_CONTEXT.md` si cambió algo que describe.
<!-- END agent-context -->
