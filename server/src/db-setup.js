import { readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import pool from "./db.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const schemaPath = join(__dirname, "..", "schema.sql");
const sql = readFileSync(schemaPath, "utf-8");

try {
  await pool.query(sql);
  console.log("Database schema created and seeded successfully.");
} catch (err) {
  console.error("Database setup failed:", err.message);
  process.exit(1);
} finally {
  await pool.end();
}
