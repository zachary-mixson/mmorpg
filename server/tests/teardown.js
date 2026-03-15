/**
 * Jest globalTeardown — runs once after all test suites.
 *
 * We intentionally do NOT drop the test database here.
 * The globalSetup always drops + recreates it for a clean slate,
 * so teardown just needs to close the app's connection pool.
 */
export default async function teardown() {
  try {
    const pool = (await import("../src/db.js")).default;
    await pool.end();
  } catch {
    // Pool may already be closed or not initialized
  }
}
