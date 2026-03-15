import Phaser from "phaser";

const ARENA_W = 1600;
const ARENA_H = 1600;
const ARENA_DIAG = Math.sqrt(ARENA_W * ARENA_W + ARENA_H * ARENA_H);

export default class BotController {
  /**
   * @param {import('./BotBrain.js').default} brain
   * @param {import('../entities/Bot.js').default} bot
   * @param {import('../entities/Player.js').default} player
   * @param {object} [options]
   * @param {number} [options.reactionDelay=150] — ms delay before inputs are acted on
   * @param {number} [options.rotationSpeed=0.08] — radians per frame toward target angle
   */
  constructor(brain, bot, player, options = {}) {
    this.brain = brain;
    this.bot = bot;
    this.player = player;
    this.reactionDelay = options.reactionDelay ?? 150;
    this.rotationSpeed = options.rotationSpeed ?? 0.08;

    /** @type {{time: number, outputs: number[]}[]} */
    this.actionQueue = [];
  }

  /**
   * Call every frame from scene.update(time).
   * Gathers inputs, runs predict, queues actions with delay,
   * then applies the oldest ready action.
   */
  update(time) {
    if (!this.bot.alive) {
      this.bot.body.setVelocity(0, 0);
      return;
    }

    // 1. Gather inputs and predict
    const inputs = this.gatherInputs();
    const outputs = this.brain.predict(inputs);

    // 2. Queue the action for future application
    this.actionQueue.push({ time: time + this.reactionDelay, outputs });

    // 3. Apply the oldest action whose delay has elapsed
    this.applyReadyAction(time);

    // 4. Keep health bar upright (always runs, independent of reaction delay)
    this.updateHealthBar();
  }

  /**
   * Build the 10-element normalized input vector.
   */
  gatherInputs() {
    const bot = this.bot;
    const player = this.player;

    // Nearest incoming bullet (from the player's bullet pool)
    let nearestBX = 0;
    let nearestBY = 0;
    let nearestBDist = 1; // normalized max

    let closestDistSq = Infinity;
    this.player.bullets.children.each((b) => {
      if (!b.active) return;
      const dx = b.x - bot.x;
      const dy = b.y - bot.y;
      const dSq = dx * dx + dy * dy;
      if (dSq < closestDistSq) {
        closestDistSq = dSq;
        nearestBX = b.x;
        nearestBY = b.y;
        nearestBDist = Math.sqrt(dSq);
      }
    });

    const distToPlayer = Phaser.Math.Distance.Between(
      bot.x,
      bot.y,
      player.x,
      player.y
    );

    return [
      bot.x / ARENA_W,
      bot.y / ARENA_H,
      player.x / ARENA_W,
      player.y / ARENA_H,
      nearestBX / ARENA_W,
      nearestBY / ARENA_H,
      Math.min(nearestBDist / ARENA_DIAG, 1),
      bot.health / bot.maxHealth,
      player.health / player.maxHealth,
      Math.min(distToPlayer / ARENA_DIAG, 1),
    ];
  }

  /**
   * Find and apply the oldest queued action that is ready (delay elapsed).
   * Discard any older stale entries.
   */
  applyReadyAction(time) {
    // Drop stale entries, keep only the latest ready one
    let ready = null;
    while (this.actionQueue.length > 0 && this.actionQueue[0].time <= time) {
      ready = this.actionQueue.shift();
    }

    if (!ready) {
      // No action ready yet — hold current velocity
      return;
    }

    const [moveX, moveY, rotate, shoot, strafe] = ready.outputs;
    const bot = this.bot;
    const speed = bot.moveSpeed;

    // --- Movement ---
    let vx = moveX * speed;
    let vy = moveY * speed;

    // --- Strafe (perpendicular to facing direction) ---
    if (Math.abs(strafe) > 0.1) {
      const perpAngle = bot.rotation + Math.PI / 2;
      vx += Math.cos(perpAngle) * strafe * speed * 0.5;
      vy += Math.sin(perpAngle) * strafe * speed * 0.5;
    }

    bot.body.setVelocity(vx, vy);

    // --- Rotation ---
    // The "rotate" output modulates how aggressively the bot tracks the player.
    // Map rotate (-1..1) to a blend: -1 = don't rotate, 1 = full tracking speed
    const rotateStrength = Math.max(0, (rotate + 1) / 2); // 0..1
    const angleToPlayer = Phaser.Math.Angle.Between(
      bot.x,
      bot.y,
      this.player.x,
      this.player.y
    );
    bot.rotation = Phaser.Math.Angle.RotateTo(
      bot.rotation,
      angleToPlayer,
      this.rotationSpeed * rotateStrength
    );

    // --- Shoot ---
    if (shoot > 0.5) {
      bot.shoot(ready.time);
    }
  }

  updateHealthBar() {
    const bot = this.bot;
    bot.hpBarBg.rotation = -bot.rotation;
    bot.hpBar.rotation = -bot.rotation;
    const barOffsetY = -28;
    bot.hpBarBg.setPosition(
      Math.sin(-bot.rotation) * barOffsetY,
      Math.cos(-bot.rotation) * barOffsetY * -1
    );
    bot.hpBar.setPosition(bot.hpBarBg.x, bot.hpBarBg.y);
  }

  /**
   * Update the reaction delay (e.g. after purchasing an upgrade).
   */
  setReactionDelay(ms) {
    this.reactionDelay = ms;
  }

  /**
   * Clear queued actions (e.g. on respawn).
   */
  reset() {
    this.actionQueue = [];
  }
}
