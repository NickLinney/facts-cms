# FACTS

FACTS is a pre-alpha MVP for a composable meta-model workspace. It lets a user define entity, relationship, view, and presentation types; create entity records; and connect records with relationship records.

## Run locally

```bash
docker compose up --build
```

Open http://localhost:3000. Postgres is seeded with four abstract core definitions. Reset with `docker compose down -v`.

For repeatable QA, set `FACTS_RUN_ID=2026-09-03T-OWL-002` before starting the stack. The run identifier and release version appear in the workspace. The overview's **Reset test workspace** action clears records and custom definitions while preserving the four core definitions; it is disabled when `NODE_ENV=production`.

## Release

Snapshot: `0.0.0-pre-alpha.2`. Release branch: `release/0.0.0-pre-alpha-2`. Annotated tag: `0.0.0-pre-alpha.2`.
