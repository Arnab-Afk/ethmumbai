/**
 * src/db.js
 * Optional Postgres connection. Falls back to in-memory store when DB is not configured.
 */

const { Pool } = require("pg");

const hasDbConfig = Boolean(
  process.env.DATABASE_URL || process.env.PGHOST || process.env.PGDATABASE
);

let pool = null;

if (hasDbConfig) {
  pool = new Pool(
    process.env.DATABASE_URL
      ? { connectionString: process.env.DATABASE_URL }
      : {
          host: process.env.PGHOST,
          port: Number(process.env.PGPORT || 5432),
          database: process.env.PGDATABASE,
          user: process.env.PGUSER,
          password: process.env.PGPASSWORD,
        }
  );

  pool.on("error", (err) => {
    console.error("[db] Unexpected Postgres pool error:", err.message);
  });
}

function isEnabled() {
  return Boolean(pool);
}

async function query(text, params = []) {
  if (!pool) {
    throw new Error("Postgres is not configured");
  }
  return pool.query(text, params);
}

module.exports = { isEnabled, query };
