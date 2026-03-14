# Postgres (Docker)

This project includes a local Postgres service for persistence.

## Start

```bash
docker compose -f docker-compose.postgres.yml up -d
```

## Stop

```bash
docker compose -f docker-compose.postgres.yml down
```

## Reset data

```bash
docker compose -f docker-compose.postgres.yml down -v
```

## Default connection

- Host: localhost
- Port: 5432
- Database: everdeploy
- User: everdeploy
- Password: everdeploy_dev_password

Connection string:

```text
postgresql://everdeploy:everdeploy_dev_password@localhost:5432/everdeploy
```

Schema bootstrap runs from `docker/postgres/init/001_schema.sql` on first startup.
