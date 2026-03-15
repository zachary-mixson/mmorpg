import pg from "pg";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));

const TEST_DB = "ai_shooter_test";

// Admin pool (connects to 'postgres' to create/drop test db)
function createAdminPool() {
  return new pg.Pool({
    host: process.env.PGHOST || "localhost",
    port: parseInt(process.env.PGPORT || "5432", 10),
    database: "postgres",
    user: process.env.PGUSER || "postgres",
    password: process.env.PGPASSWORD || "postgres",
  });
}

// Test pool (connects to the test database)
function createTestPool() {
  return new pg.Pool({
    host: process.env.PGHOST || "localhost",
    port: parseInt(process.env.PGPORT || "5432", 10),
    database: TEST_DB,
    user: process.env.PGUSER || "postgres",
    password: process.env.PGPASSWORD || "postgres",
  });
}

/**
 * Create the test database if it doesn't exist, then run schema.sql.
 */
export async function setupTestDb() {
  const admin = createAdminPool();

  try {
    // Drop and recreate for a clean slate
    await admin.query(`DROP DATABASE IF EXISTS ${TEST_DB}`);
    await admin.query(`CREATE DATABASE ${TEST_DB}`);
  } finally {
    await admin.end();
  }

  const pool = createTestPool();
  try {
    // Run schema (includes CREATE TABLE + seed data)
    const schemaPath = join(__dirname, "..", "schema.sql");
    const schema = readFileSync(schemaPath, "utf-8");
    await pool.query(schema);

    // Seed test players (passwords are bcrypt hashes of "password123")
    const bcrypt = await import("bcrypt");
    const hash = await bcrypt.default.hash("password123", 10);

    await pool.query(
      "INSERT INTO players (username, password_hash, currency) VALUES ($1, $2, $3) ON CONFLICT (username) DO NOTHING",
      ["testplayer1", hash, 500]
    );
    await pool.query(
      "INSERT INTO players (username, password_hash, currency) VALUES ($1, $2, $3) ON CONFLICT (username) DO NOTHING",
      ["testplayer2", hash, 1000]
    );

    // Seed sample AI weights for testplayer1
    const player1 = await pool.query(
      "SELECT id FROM players WHERE username = 'testplayer1'"
    );
    const p1Id = player1.rows[0].id;

    const sampleWeights = [
      { shape: [10, 16], data: new Array(160).fill(0.1) },
      { shape: [16], data: new Array(16).fill(0) },
    ];

    await pool.query(
      "INSERT INTO ai_weights (player_id, weights_json, version, fitness) VALUES ($1, $2, 1, 12.5)",
      [p1Id, JSON.stringify(sampleWeights)]
    );
    await pool.query(
      "INSERT INTO ai_weights (player_id, weights_json, version, fitness) VALUES ($1, $2, 2, 18.3)",
      [p1Id, JSON.stringify(sampleWeights)]
    );
  } finally {
    await pool.end();
  }
}

/**
 * Truncate all data tables (preserving schema and upgrades seed data).
 * Call between test suites for isolation.
 */
export async function cleanupTables() {
  const pool = createTestPool();
  try {
    await pool.query("DELETE FROM ai_weights");
    await pool.query("DELETE FROM player_upgrades");
    await pool.query("DELETE FROM players CASCADE");

    // Re-seed test players
    const bcrypt = await import("bcrypt");
    const hash = await bcrypt.default.hash("password123", 10);
    await pool.query(
      "INSERT INTO players (username, password_hash, currency) VALUES ($1, $2, $3)",
      ["testplayer1", hash, 500]
    );
    await pool.query(
      "INSERT INTO players (username, password_hash, currency) VALUES ($1, $2, $3)",
      ["testplayer2", hash, 1000]
    );
  } finally {
    await pool.end();
  }
}

/**
 * Drop the test database entirely.
 */
export async function teardownTestDb() {
  const admin = createAdminPool();
  try {
    // Terminate active connections before dropping
    await admin.query(`
      SELECT pg_terminate_backend(pid)
      FROM pg_stat_activity
      WHERE datname = '${TEST_DB}' AND pid <> pg_backend_pid()
    `);
    await admin.query(`DROP DATABASE IF EXISTS ${TEST_DB}`);
  } finally {
    await admin.end();
  }
}
