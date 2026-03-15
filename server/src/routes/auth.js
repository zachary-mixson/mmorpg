import { Router } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { query } from "../db.js";

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-me";
const SALT_ROUNDS = 10;

router.post("/register", async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: "Username and password are required" });
  }

  try {
    const existing = await query(
      "SELECT id FROM players WHERE username = $1",
      [username]
    );
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: "Username already taken" });
    }

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    const result = await query(
      "INSERT INTO players (username, password_hash) VALUES ($1, $2) RETURNING id, username, currency, created_at",
      [username, passwordHash]
    );

    const player = result.rows[0];
    const token = jwt.sign(
      { id: player.id, username: player.username },
      JWT_SECRET,
      { expiresIn: "24h" }
    );

    res.status(201).json({ token, player });
  } catch (err) {
    console.error("Registration error:", err.message);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/login", async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: "Username and password are required" });
  }

  try {
    const result = await query(
      "SELECT id, username, password_hash, currency, created_at FROM players WHERE username = $1",
      [username]
    );
    if (result.rows.length === 0) {
      return res.status(401).json({ error: "Invalid username or password" });
    }

    const player = result.rows[0];
    const valid = await bcrypt.compare(password, player.password_hash);
    if (!valid) {
      return res.status(401).json({ error: "Invalid username or password" });
    }

    const token = jwt.sign(
      { id: player.id, username: player.username },
      JWT_SECRET,
      { expiresIn: "24h" }
    );

    res.json({
      token,
      player: {
        id: player.id,
        username: player.username,
        currency: player.currency,
        created_at: player.created_at,
      },
    });
  } catch (err) {
    console.error("Login error:", err.message);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/me", async (req, res) => {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing or invalid token" });
  }

  let user;
  try {
    user = jwt.verify(header.slice(7), JWT_SECRET);
  } catch {
    return res.status(401).json({ error: "Invalid or expired token" });
  }

  try {
    const result = await query(
      "SELECT id, username, currency, created_at FROM players WHERE id = $1",
      [user.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Player not found" });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error("Me error:", err.message);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
