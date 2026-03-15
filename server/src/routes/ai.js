import { Router } from "express";
import authMiddleware from "../middleware/authMiddleware.js";
import { query } from "../db.js";

const router = Router();

// Get the player's latest AI weights
router.get("/weights", authMiddleware, async (req, res) => {
  try {
    const result = await query(
      "SELECT weights_json, version FROM ai_weights WHERE player_id = $1 ORDER BY version DESC LIMIT 1",
      [req.user.id]
    );

    if (result.rows.length === 0) {
      return res.json({ weights: null, version: 0 });
    }

    const row = result.rows[0];
    res.json({ weights: row.weights_json, version: row.version });
  } catch (err) {
    console.error("Get weights error:", err.message);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Save new AI weights
router.post("/weights", authMiddleware, async (req, res) => {
  const { weights } = req.body;

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
      "INSERT INTO ai_weights (player_id, weights_json, version) VALUES ($1, $2, $3) RETURNING id, version, created_at",
      [req.user.id, JSON.stringify(weights), nextVersion]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error("Save weights error:", err.message);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
