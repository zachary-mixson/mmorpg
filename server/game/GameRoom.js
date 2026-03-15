import jwt from "jsonwebtoken";
import { query } from "../src/db.js";
import setupMatchmaker from "./Matchmaker.js";

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-me";

const TICK_RATE = 20; // ticks per second
const TICK_MS = 1000 / TICK_RATE;
export const MATCH_DURATION = 180_000; // 3 minutes in ms
export const ARENA_W = 1600;
export const ARENA_H = 1600;
const WALL_T = 16;
const BULLET_SPEED = 600;
const BULLET_LIFESPAN = 1200;
const BOT_SHOOT_RANGE = 400;
const BOT_APPROACH_DIST = 200;

const BASE_STATS = {
  player: {
    move_speed: 200,
    fire_rate: 250,
    bullet_damage: 20,
    max_health: 100,
  },
  bot: {
    reaction_speed: 150,
    health: 100,
    fire_rate: 400,
  },
};

// In-memory rooms keyed by room ID
export const rooms = new Map();
let roomIdCounter = 0;

/**
 * Load compiled stats for a player (base * upgrade multipliers).
 */
async function loadPlayerStats(playerId) {
  const result = await query(
    `SELECT u.type, u.stat_key, u.stat_value
     FROM player_upgrades pu
     JOIN upgrades u ON u.id = pu.upgrade_id
     WHERE pu.player_id = $1`,
    [playerId]
  );

  const stats = {
    player: { ...BASE_STATS.player },
    bot: { ...BASE_STATS.bot },
  };

  for (const row of result.rows) {
    const group = stats[row.type];
    if (group && row.stat_key in group) {
      group[row.stat_key] = group[row.stat_key] * parseFloat(row.stat_value);
    }
  }

  return stats;
}

/**
 * Load latest bot weights for a player.
 */
async function loadBotWeights(playerId) {
  const result = await query(
    "SELECT weights_json FROM ai_weights WHERE player_id = $1 ORDER BY version DESC LIMIT 1",
    [playerId]
  );
  return result.rows.length > 0 ? result.rows[0].weights_json : null;
}

/**
 * Grant currency reward to a player.
 */
async function grantReward(playerId, kills, won) {
  let reward = 5; // base
  reward += kills * 10;
  if (won) reward += 50;

  await query(
    "UPDATE players SET currency = currency + $1 WHERE id = $2",
    [reward, playerId]
  );

  return reward;
}

/**
 * Create a new game room.
 */
export function createRoom() {
  const id = `room_${++roomIdCounter}`;
  const room = {
    id,
    players: {},    // socketId → player state
    bullets: [],    // active bullets
    bots: {},       // socketId → bot state
    scores: {},     // socketId → { kills }
    startTime: null,
    tickInterval: null,
    matchEnded: false,
  };
  rooms.set(id, room);
  return room;
}

/**
 * Initialize a player's state in the room.
 */
export function initPlayerState(room, socketId, userId, username, stats, spawnX, spawnY) {
  room.players[socketId] = {
    id: userId,
    username,
    x: spawnX,
    y: spawnY,
    rotation: 0,
    health: stats.player.max_health,
    maxHealth: stats.player.max_health,
    moveSpeed: stats.player.move_speed,
    fireRate: stats.player.fire_rate,
    bulletDamage: stats.player.bullet_damage,
    alive: true,
    lastFired: 0,
  };
  room.scores[socketId] = { kills: 0 };
}

/**
 * Initialize a bot's state in the room.
 */
export function initBotState(room, socketId, stats, spawnX, spawnY) {
  room.bots[socketId] = {
    x: spawnX,
    y: spawnY,
    rotation: 0,
    health: stats.bot.health,
    maxHealth: stats.bot.health,
    moveSpeed: 150,
    fireRate: stats.bot.fire_rate,
    bulletDamage: 15,
    alive: true,
    lastFired: 0,
    strafeDir: 1,
    lastStrafeChange: 0,
  };
}

/**
 * Clamp a value between min and max.
 */
function clamp(val, min, max) {
  return Math.max(min, Math.min(max, val));
}

/**
 * Distance between two points.
 */
function dist(x1, y1, x2, y2) {
  return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
}

/**
 * Validate a position update from a client.
 * Rejects moves that exceed the player's max speed per tick.
 */
function validateMove(player, newX, newY) {
  const maxDist = (player.moveSpeed * 3.5) / TICK_RATE; // 3.5x to allow dash
  const moved = dist(player.x, player.y, newX, newY);

  if (moved > maxDist) {
    return false;
  }

  // Clamp to arena bounds
  const margin = WALL_T + 16;
  const cx = clamp(newX, margin, ARENA_W - margin);
  const cy = clamp(newY, margin, ARENA_H - margin);

  return { x: cx, y: cy };
}

/**
 * Run simplified bot AI for one tick.
 */
function updateBot(bot, targetX, targetY, now) {
  if (!bot.alive) return;

  const dx = targetX - bot.x;
  const dy = targetY - bot.y;
  const d = Math.sqrt(dx * dx + dy * dy);

  // Rotate toward target
  bot.rotation = Math.atan2(dy, dx);

  // Strafe change every 2 seconds
  if (now - bot.lastStrafeChange > 2000) {
    bot.strafeDir = Math.random() > 0.5 ? 1 : -1;
    bot.lastStrafeChange = now;
  }

  // Movement
  let vx = 0;
  let vy = 0;

  if (d > BOT_APPROACH_DIST) {
    // Move toward target
    vx = (dx / d) * bot.moveSpeed;
    vy = (dy / d) * bot.moveSpeed;
  }

  // Strafe perpendicular
  const strafeSpeed = bot.moveSpeed * 0.5;
  vx += (-dy / d) * strafeSpeed * bot.strafeDir;
  vy += (dx / d) * strafeSpeed * bot.strafeDir;

  // Apply movement
  const step = 1 / TICK_RATE;
  bot.x += vx * step;
  bot.y += vy * step;

  // Clamp to arena
  const margin = WALL_T + 16;
  bot.x = clamp(bot.x, margin, ARENA_W - margin);
  bot.y = clamp(bot.y, margin, ARENA_H - margin);

  return d; // return distance for shoot decision
}

/**
 * Start the game loop for a room.
 */
export function startRoom(room, io) {
  room.startTime = Date.now();

  room.tickInterval = setInterval(() => {
    if (room.matchEnded) return;

    const now = Date.now();
    const elapsed = now - room.startTime;

    // Check match timer
    if (elapsed >= MATCH_DURATION) {
      endMatch(room, io);
      return;
    }

    const playerEntries = Object.entries(room.players);

    // Update bots — each bot targets the opposing player
    for (const [socketId, bot] of Object.entries(room.bots)) {
      if (!bot.alive) continue;

      // Find the opposing player
      const opponent = playerEntries.find(([sid]) => sid !== socketId);
      if (!opponent) continue;

      const [, opponentPlayer] = opponent;
      if (!opponentPlayer.alive) continue;

      const d = updateBot(bot, opponentPlayer.x, opponentPlayer.y, now);

      // Shoot if in range and cooldown elapsed
      if (d < BOT_SHOOT_RANGE && now - bot.lastFired >= bot.fireRate) {
        bot.lastFired = now;
        room.bullets.push({
          x: bot.x + Math.cos(bot.rotation) * 20,
          y: bot.y + Math.sin(bot.rotation) * 20,
          vx: Math.cos(bot.rotation) * BULLET_SPEED,
          vy: Math.sin(bot.rotation) * BULLET_SPEED,
          damage: bot.bulletDamage,
          owner: socketId,
          ownerType: "bot",
          spawnTime: now,
        });
      }
    }

    // Update bullets
    const step = 1 / TICK_RATE;
    const aliveBullets = [];

    for (const bullet of room.bullets) {
      bullet.x += bullet.vx * step;
      bullet.y += bullet.vy * step;

      // Remove if expired or out of bounds
      if (
        now - bullet.spawnTime > BULLET_LIFESPAN ||
        bullet.x < 0 || bullet.x > ARENA_W ||
        bullet.y < 0 || bullet.y > ARENA_H
      ) {
        continue;
      }

      // Check bullet-player collisions
      let hit = false;
      for (const [sid, player] of playerEntries) {
        if (!player.alive) continue;
        if (sid === bullet.owner && bullet.ownerType === "player") continue;

        if (dist(bullet.x, bullet.y, player.x, player.y) < 20) {
          player.health = Math.max(0, player.health - bullet.damage);
          hit = true;

          if (player.health <= 0) {
            player.alive = false;
            // Credit kill to bullet owner
            if (room.scores[bullet.owner]) {
              room.scores[bullet.owner].kills++;
            }
            // Respawn after 2 seconds
            setTimeout(() => {
              if (!room.matchEnded) {
                player.health = player.maxHealth;
                player.alive = true;
                player.x = ARENA_W / 2 + (Math.random() - 0.5) * 400;
                player.y = ARENA_H / 2 + (Math.random() - 0.5) * 400;
              }
            }, 2000);
          }
          break;
        }
      }

      // Check bullet-bot collisions
      if (!hit) {
        for (const [sid, bot] of Object.entries(room.bots)) {
          if (!bot.alive) continue;
          if (sid === bullet.owner && bullet.ownerType === "bot") continue;

          if (dist(bullet.x, bullet.y, bot.x, bot.y) < 20) {
            bot.health = Math.max(0, bot.health - bullet.damage);
            hit = true;

            if (bot.health <= 0) {
              bot.alive = false;
              if (room.scores[bullet.owner]) {
                room.scores[bullet.owner].kills++;
              }
              setTimeout(() => {
                if (!room.matchEnded) {
                  bot.health = bot.maxHealth;
                  bot.alive = true;
                  bot.x = ARENA_W / 2 + (Math.random() - 0.5) * 400;
                  bot.y = ARENA_H / 2 + (Math.random() - 0.5) * 400;
                }
              }, 3000);
            }
            break;
          }
        }
      }

      if (!hit) {
        aliveBullets.push(bullet);
      }
    }

    room.bullets = aliveBullets;

    // Broadcast game state to all players in the room
    const state = {
      timeRemaining: Math.max(0, MATCH_DURATION - elapsed),
      players: {},
      bots: {},
      bullets: room.bullets.map((b) => ({ x: b.x, y: b.y })),
      scores: room.scores,
    };

    for (const [sid, p] of playerEntries) {
      state.players[sid] = {
        username: p.username,
        x: p.x,
        y: p.y,
        rotation: p.rotation,
        health: p.health,
        maxHealth: p.maxHealth,
        alive: p.alive,
      };
    }

    for (const [sid, b] of Object.entries(room.bots)) {
      state.bots[sid] = {
        x: b.x,
        y: b.y,
        rotation: b.rotation,
        health: b.health,
        maxHealth: b.maxHealth,
        alive: b.alive,
      };
    }

    io.to(room.id).emit("gameState", state);
  }, TICK_MS);
}

/**
 * End the match and distribute rewards.
 */
export async function endMatch(room, io) {
  if (room.matchEnded) return;
  room.matchEnded = true;

  clearInterval(room.tickInterval);

  // Determine winner by kills
  const entries = Object.entries(room.scores);
  let winnerSocket = null;
  let maxKills = -1;

  for (const [sid, score] of entries) {
    if (score.kills > maxKills) {
      maxKills = score.kills;
      winnerSocket = sid;
    }
  }

  // Check for tie
  const isTie = entries.filter(([, s]) => s.kills === maxKills).length > 1;

  // Grant rewards
  const results = {};
  for (const [sid, player] of Object.entries(room.players)) {
    const kills = room.scores[sid]?.kills || 0;
    const won = !isTie && sid === winnerSocket;
    const reward = await grantReward(player.id, kills, won);

    results[sid] = {
      username: player.username,
      kills,
      won,
      reward,
    };
  }

  io.to(room.id).emit("matchEnd", {
    results,
    tie: isTie,
    winner: isTie ? null : room.players[winnerSocket]?.username,
  });

  // Cleanup after a delay to let clients process
  setTimeout(() => {
    rooms.delete(room.id);
  }, 5000);
}

/**
 * Authenticate a socket connection via JWT.
 */
function authenticateSocket(socket, next) {
  const token = socket.handshake.auth?.token;
  if (!token) {
    return next(new Error("Authentication required"));
  }

  try {
    const user = jwt.verify(token, JWT_SECRET);
    socket.user = user;
    next();
  } catch {
    next(new Error("Invalid token"));
  }
}

/**
 * Set up Socket.io event handlers for the game rooms.
 */
export default function setupGameRooms(io) {
  const gameNsp = io.of("/game");
  gameNsp.use(authenticateSocket);

  // Wire up matchmaking on the same namespace
  setupMatchmaker(gameNsp);

  gameNsp.on("connection", async (socket) => {
    console.log(`Game: ${socket.user.username} connected (${socket.id})`);

    // Load player data
    let stats, botWeights;
    try {
      stats = await loadPlayerStats(socket.user.id);
      botWeights = await loadBotWeights(socket.user.id);
    } catch (err) {
      console.error("Failed to load player data:", err.message);
      socket.emit("error", { message: "Failed to load player data" });
      socket.disconnect();
      return;
    }

    // Store on socket for later use
    socket.stats = stats;
    socket.botWeights = botWeights;

    /**
     * Player sends movement/rotation update.
     */
    socket.on("playerUpdate", (data) => {
      const room = rooms.get(socket.roomId);
      if (!room || room.matchEnded) return;

      const player = room.players[socket.id];
      if (!player || !player.alive) return;

      // Validate movement
      const result = validateMove(player, data.x, data.y);
      if (result === false) {
        // Reject — send correction
        socket.emit("positionCorrection", { x: player.x, y: player.y });
        return;
      }

      player.x = result.x;
      player.y = result.y;
      player.rotation = data.rotation ?? player.rotation;
    });

    /**
     * Player fires a bullet.
     */
    socket.on("shoot", (data) => {
      const room = rooms.get(socket.roomId);
      if (!room || room.matchEnded) return;

      const player = room.players[socket.id];
      if (!player || !player.alive) return;

      const now = Date.now();
      if (now - player.lastFired < player.fireRate) return;
      player.lastFired = now;

      const angle = data.angle ?? player.rotation;
      room.bullets.push({
        x: player.x + Math.cos(angle) * 24,
        y: player.y + Math.sin(angle) * 24,
        vx: Math.cos(angle) * BULLET_SPEED,
        vy: Math.sin(angle) * BULLET_SPEED,
        damage: player.bulletDamage,
        owner: socket.id,
        ownerType: "player",
        spawnTime: now,
      });
    });
  });
}
