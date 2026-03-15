import pg from "pg";

const pool = new pg.Pool({
  host: process.env.PGHOST || "localhost",
  port: parseInt(process.env.PGPORT || "5432", 10),
  database: process.env.PGDATABASE || "ai_shooter",
  user: process.env.PGUSER || "postgres",
  password: process.env.PGPASSWORD || "postgres",
});

export function query(text, params) {
  return pool.query(text, params);
}

export default pool;
