import { Router } from "express";
import authMiddleware from "../middleware/authMiddleware.js";
import { query } from "../db.js";

const router = Router();

// GET /ai/weights — returns the current (latest) weights
router.get("/weights", authMiddleware, async (req, res) => {
  try {
    const result = await query(
      "SELECT weights_json, version, fitness, created_at FROM ai_weights WHERE player_id = $1 ORDER BY version DESC LIMIT 1",
      [req.user.id]
    );

    if (result.rows.length === 0) {
      return res.json({ weights: null, version: 0, fitness: null });
    }

    const row = result.rows[0];
    res.json({
      weights: row.weights_json,
      version: row.version,
      fitness: row.fitness != null ? parseFloat(row.fitness) : null,
      created_at: row.created_at,
    });
  } catch (err) {
    console.error("Get weights error:", err.message);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /ai/weights/history — returns all saved versions (without full weights blob)
router.get("/weights/history", authMiddleware, async (req, res) => {
  try {
    const result = await query(
      "SELECT id, version, fitness, created_at FROM ai_weights WHERE player_id = $1 ORDER BY version DESC",
      [req.user.id]
    );

    res.json({
      versions: result.rows.map((row) => ({
        id: row.id,
        version: row.version,
        fitness: row.fitness != null ? parseFloat(row.fitness) : null,
        created_at: row.created_at,
      })),
    });
  } catch (err) {
    console.error("Weights history error:", err.message);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /ai/weights — saves new weights as a new version (append, never overwrite)
router.post("/weights", authMiddleware, async (req, res) => {
  const { weights, fitness } = req.body;

  if (!weights) {
    return res.status(400).json({ error: "Weights data is required" });
  }

  try {
    // Get current max version
    const vResult = await query(
      "SELECT COALESCE(MAX(version), 0) AS max_version FROM ai_weights WHERE player_id = $1",
      [req.user.id]
    );
    const nextVersion = vResult.rows[0].max_version + 1;

    const result = await query(
      "INSERT INTO ai_weights (player_id, weights_json, version, fitness) VALUES ($1, $2, $3, $4) RETURNING id, version, fitness, created_at",
      [req.user.id, JSON.stringify(weights), nextVersion, fitness ?? null]
    );

    const row = result.rows[0];
    res.status(201).json({
      id: row.id,
      version: row.version,
      fitness: row.fitness != null ? parseFloat(row.fitness) : null,
      created_at: row.created_at,
    });
  } catch (err) {
    console.error("Save weights error:", err.message);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /ai/weights/rollback/:version — copies a previous version's weights as a new latest version
router.post("/weights/rollback/:version", authMiddleware, async (req, res) => {
  const targetVersion = parseInt(req.params.version, 10);
  if (isNaN(targetVersion) || targetVersion < 1) {
    return res.status(400).json({ error: "Invalid version number" });
  }

  try {
    // Fetch the target version's weights
    const sourceResult = await query(
      "SELECT weights_json, fitness FROM ai_weights WHERE player_id = $1 AND version = $2",
      [req.user.id, targetVersion]
    );

    if (sourceResult.rows.length === 0) {
      return res.status(404).json({ error: "Version not found" });
    }

    const source = sourceResult.rows[0];

    // Get current max version
    const vResult = await query(
      "SELECT COALESCE(MAX(version), 0) AS max_version FROM ai_weights WHERE player_id = $1",
      [req.user.id]
    );
    const nextVersion = vResult.rows[0].max_version + 1;

    // Insert as new version (preserving the original fitness)
    const result = await query(
      "INSERT INTO ai_weights (player_id, weights_json, version, fitness) VALUES ($1, $2, $3, $4) RETURNING id, version, fitness, created_at",
      [req.user.id, JSON.stringify(source.weights_json), nextVersion, source.fitness]
    );

    const row = result.rows[0];
    res.status(201).json({
      id: row.id,
      version: row.version,
      fitness: row.fitness != null ? parseFloat(row.fitness) : null,
      created_at: row.created_at,
      rolledBackFrom: targetVersion,
    });
  } catch (err) {
    console.error("Rollback error:", err.message);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
