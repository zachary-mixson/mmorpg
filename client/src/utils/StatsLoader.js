const API_URL = "http://localhost:3000";

// Default base stats (must match server BASE_STATS)
const DEFAULTS = {
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

let cachedStats = null;

/**
 * Fetch compiled stats from the server, with session caching.
 * Returns { player: {...}, bot: {...} } with upgrade multipliers applied.
 */
export async function loadStats() {
  if (cachedStats) return cachedStats;
  return forceRefresh();
}

/**
 * Force re-fetch from server, bypassing cache.
 */
export async function forceRefresh() {
  try {
    const token = localStorage.getItem("token");
    const res = await fetch(`${API_URL}/shop/mystats`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (res.ok) {
      const data = await res.json();
      cachedStats = data.stats;
      return cachedStats;
    }
  } catch {
    // Network error — fall through to defaults
  }

  cachedStats = {
    player: { ...DEFAULTS.player },
    bot: { ...DEFAULTS.bot },
  };
  return cachedStats;
}

/**
 * Clear the cached stats (e.g. on logout).
 */
export function clearCache() {
  cachedStats = null;
}

/**
 * Convert server stat keys to Player constructor stat format.
 * @param {object} serverStats — the player group from loadStats()
 * @returns {object} — { moveSpeed, fireRate, bulletDamage, maxHealth, hasDash, shieldDuration }
 */
export function toPlayerStats(serverStats) {
  return {
    moveSpeed: serverStats.move_speed,
    fireRate: serverStats.fire_rate,
    bulletDamage: serverStats.bullet_damage,
    maxHealth: serverStats.max_health,
    hasDash: serverStats.dash > 0,
    shieldDuration: serverStats.shield_duration,
  };
}

/**
 * Convert server stat keys to Bot constructor stat format + BotController options.
 * @param {object} serverStats — the bot group from loadStats()
 * @returns {{ botStats: object, controllerOptions: object }}
 */
export function toBotStats(serverStats) {
  return {
    botStats: {
      maxHealth: serverStats.health,
      fireRate: serverStats.fire_rate,
    },
    controllerOptions: {
      reactionDelay: serverStats.reaction_speed,
      aggressionMultiplier: serverStats.aggression,
      accuracyBonus: serverStats.accuracy,
    },
  };
}
