import { Router } from "express";
import authMiddleware from "../middleware/authMiddleware.js";
import { query } from "../db.js";

const router = Router();

router.use(authMiddleware);

const BASE_STATS = {
  player: {
    move_speed: 200,
    fire_rate: 250,
    bullet_damage: 20,
    max_health: 100,
    shield_duration: 0,
    dash: 0,
  },
  bot: {
    reaction_speed: 150,
    aggression: 1.0,
    accuracy: 1.0,
    memory_depth: 1,
    health: 100,
    fire_rate: 400,
  },
};

// GET /shop/items — all upgrades with "purchased" boolean for current player
router.get("/items", async (req, res) => {
  try {
    const result = await query(
      `SELECT u.*,
              CASE WHEN pu.id IS NOT NULL THEN true ELSE false END AS purchased
       FROM upgrades u
       LEFT JOIN player_upgrades pu
         ON pu.upgrade_id = u.id AND pu.player_id = $1
       ORDER BY u.type, u.id`,
      [req.user.id]
    );
    res.json({ items: result.rows });
  } catch (err) {
    console.error("Shop items error:", err.message);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /shop/buy/:upgradeId — purchase an upgrade
router.post("/buy/:upgradeId", async (req, res) => {
  const upgradeId = parseInt(req.params.upgradeId, 10);
  if (isNaN(upgradeId)) {
    return res.status(400).json({ error: "Invalid upgrade ID" });
  }

  try {
    // Check upgrade exists
    const upgradeResult = await query(
      "SELECT id, price FROM upgrades WHERE id = $1",
      [upgradeId]
    );
    if (upgradeResult.rows.length === 0) {
      return res.status(404).json({ error: "Upgrade not found" });
    }
    const upgrade = upgradeResult.rows[0];

    // Check not already owned
    const ownedResult = await query(
      "SELECT id FROM player_upgrades WHERE player_id = $1 AND upgrade_id = $2",
      [req.user.id, upgradeId]
    );
    if (ownedResult.rows.length > 0) {
      return res.status(409).json({ error: "Upgrade already owned" });
    }

    // Check sufficient funds
    const playerResult = await query(
      "SELECT currency FROM players WHERE id = $1",
      [req.user.id]
    );
    const currency = playerResult.rows[0].currency;
    if (currency < upgrade.price) {
      return res.status(400).json({ error: "Insufficient funds" });
    }

    // Deduct currency and insert purchase
    const newCurrency = currency - upgrade.price;
    await query("UPDATE players SET currency = $1 WHERE id = $2", [
      newCurrency,
      req.user.id,
    ]);
    await query(
      "INSERT INTO player_upgrades (player_id, upgrade_id) VALUES ($1, $2)",
      [req.user.id, upgradeId]
    );

    res.json({ currency: newCurrency });
  } catch (err) {
    console.error("Shop buy error:", err.message);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /shop/mystats — compiled stats (base + upgrade bonuses)
router.get("/mystats", async (req, res) => {
  try {
    const result = await query(
      `SELECT u.type, u.stat_key, u.stat_value
       FROM player_upgrades pu
       JOIN upgrades u ON u.id = pu.upgrade_id
       WHERE pu.player_id = $1`,
      [req.user.id]
    );

    // Deep-copy base stats
    const stats = {
      player: { ...BASE_STATS.player },
      bot: { ...BASE_STATS.bot },
    };

    // Apply multipliers
    for (const row of result.rows) {
      const group = stats[row.type];
      if (group && row.stat_key in group) {
        group[row.stat_key] = group[row.stat_key] * parseFloat(row.stat_value);
      }
    }

    // Round for cleanliness
    for (const group of Object.values(stats)) {
      for (const key of Object.keys(group)) {
        group[key] = Math.round(group[key] * 100) / 100;
      }
    }

    res.json({ stats });
  } catch (err) {
    console.error("My stats error:", err.message);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
