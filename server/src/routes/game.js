import { Router } from "express";
import authMiddleware from "../middleware/authMiddleware.js";
import { query } from "../db.js";

const router = Router();

router.use(authMiddleware);

// POST /game/reward — grant currency after a match
// Body: { won: boolean, kills: number }
router.post("/reward", async (req, res) => {
  const { won, kills } = req.body;
  const killCount = parseInt(kills, 10) || 0;

  let reward = 5; // base reward for playing
  reward += killCount * 10;
  if (won) reward += 50;

  try {
    const result = await query(
      "UPDATE players SET currency = currency + $1 WHERE id = $2 RETURNING currency",
      [reward, req.user.id]
    );

    res.json({
      reward,
      currency: result.rows[0].currency,
      breakdown: {
        matchPlayed: 5,
        kills: killCount * 10,
        win: won ? 50 : 0,
      },
    });
  } catch (err) {
    console.error("Reward error:", err.message);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
