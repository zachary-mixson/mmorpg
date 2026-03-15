import { setupTestDb } from "./testDb.js";

/**
 * Jest globalSetup — runs once before all test suites.
 * Creates the test database, applies schema, and seeds data.
 */
export default async function setup() {
  // Point the app's db module at the test database
  process.env.PGDATABASE = "ai_shooter_test";
  process.env.JWT_SECRET = "test-jwt-secret";

  await setupTestDb();
}
