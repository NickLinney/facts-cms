# FACTS

FACTS is a pre-alpha MVP for a composable meta-model workspace. It lets a user define entity, relationship, view, and presentation types; create entity records; and connect records with relationship records.

## Run locally

```bash
docker compose up --build
```

Open http://localhost:3000. Postgres is seeded with four abstract core definitions. Reset with `docker compose down -v`.

## Release

Snapshot: `0.0.0-pre-alpha.1`. Release branch: `release/0.0.0-pre-alpha-1`. Annotated tag: `0.0.0-pre-alpha.1`.
