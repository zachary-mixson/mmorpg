import Phaser from "phaser";
import Player from "../entities/Player.js";
import Bot from "../entities/Bot.js";
import BotBrain from "../ai/BotBrain.js";
import BotController from "../ai/BotController.js";
import Trainer from "../ai/Trainer.js";
import { loadStats, toPlayerStats, toBotStats } from "../utils/StatsLoader.js";
import { generateFXTextures, createThinkingDot } from "../utils/GameFeel.js";

const API_URL = "http://localhost:3000";
const ARENA_W = 1600;
const ARENA_H = 1600;
const WALL_T = 16;
const SPAWN_CLEAR = 300;
const MATCH_DURATION = 120_000; // 2 minutes in ms

export default class TrainingScene extends Phaser.Scene {
  constructor() {
    super("TrainingScene");
  }

  async create() {
    this.matchOver = false;
    this.matchStartTime = 0;

    // Stats tracking
    this.stats = {
      botKills: 0,
      botDeaths: 0,
      damageDealt: 0,
      damageTaken: 0,
      shotsFired: 0,
      shotsHit: 0,
    };

    // Trainer (evolutionary manager)
    this.trainer = new Trainer();

    this.generateTextures();
    generateFXTextures(this);
    this.physics.world.setBounds(0, 0, ARENA_W, ARENA_H);

    // Arena
    this.add.tileSprite(0, 0, ARENA_W, ARENA_H, "floor").setOrigin(0, 0);
    this.walls = this.physics.add.staticGroup();
    this.createWalls();
    this.obstacles = this.physics.add.staticGroup();
    this.createObstacles();

    // "Loading..." text while fetching weights + stats
    const loadingText = this.add
      .text(400, 300, "Loading...", {
        fontSize: "24px",
        color: "#a0a0cc",
      })
      .setScrollFactor(0)
      .setOrigin(0.5)
      .setDepth(200);

    // Fetch stats and weights in parallel
    let weightsData = this.trainer.getNextWeights();

    const [allStats] = await Promise.all([
      loadStats(),
      (async () => {
        if (!weightsData) {
          try {
            const token = localStorage.getItem("token");
            const res = await fetch(`${API_URL}/ai/weights`, {
              headers: { Authorization: `Bearer ${token}` },
            });
            const json = await res.json();
            if (json.weights) weightsData = json.weights;
          } catch {
            // Use random weights if fetch fails
          }
        }
      })(),
    ]);

    loadingText.destroy();

    const playerStats = toPlayerStats(allStats.player);
    const { botStats, controllerOptions } = toBotStats(allStats.bot);

    this.brain = new BotBrain(weightsData);

    // Spawn player (respawns on death during training)
    this.player = new Player(this, ARENA_W / 2 - 200, ARENA_H / 2, playerStats, () => {
      this.stats.botKills++;
      this.respawnEntity(this.player);
    });

    // Spawn bot (respawns on death during training)
    this.bot = new Bot(
      this,
      ARENA_W / 2 + 200,
      ARENA_H / 2,
      this.player,
      botStats,
      () => {
        this.stats.botDeaths++;
        this.respawnEntity(this.bot);
        this.controller.reset();
      }
    );

    // Wire BotController (neural net drives the bot, not rule-based AI)
    this.controller = new BotController(this.brain, this.bot, this.player, controllerOptions);

    // Bot thinking indicator
    createThinkingDot(this, this.bot);

    // --- Collisions ---

    // Bot bullets → Player (track damage dealt by bot)
    this.physics.add.overlap(
      this.bot.bullets,
      this.player,
      (bullet, _player) => {
        if (!bullet.active || !this.player.alive) return;
        const dmg = bullet.damage;
        bullet.deactivate();
        this.stats.damageDealt += dmg;
        this.stats.shotsHit++;
        this.player.takeDamage(dmg);
      },
      (bullet) => bullet.active && this.player.alive,
      this
    );

    // Player bullets → Bot (track damage taken by bot)
    this.physics.add.overlap(
      this.player.bullets,
      this.bot,
      (bullet, _bot) => {
        if (!bullet.active || !this.bot.alive) return;
        const dmg = bullet.damage;
        bullet.deactivate();
        this.stats.damageTaken += dmg;
        this.bot.takeDamage(dmg);
      },
      (bullet) => bullet.active && this.bot.alive,
      this
    );

    // Bullets → obstacles/walls
    const destroyBullet = (bullet) => bullet.deactivate();
    const isActive = (bullet) => bullet.active;

    this.physics.add.overlap(this.player.bullets, this.obstacles, destroyBullet, isActive, this);
    this.physics.add.overlap(this.bot.bullets, this.obstacles, destroyBullet, isActive, this);
    this.physics.add.overlap(this.player.bullets, this.walls, destroyBullet, isActive, this);
    this.physics.add.overlap(this.bot.bullets, this.walls, destroyBullet, isActive, this);

    // Entity ↔ obstacle/wall collisions
    this.physics.add.collider(this.player, this.obstacles);
    this.physics.add.collider(this.bot, this.obstacles);
    this.physics.add.collider(this.player, this.walls);
    this.physics.add.collider(this.bot, this.walls);

    // Camera
    this.cameras.main.setBounds(0, 0, ARENA_W, ARENA_H);
    this.cameras.main.startFollow(this.player, true, 0.1, 0.1);
    this.input.mouse.disableContextMenu();

    // --- HUD ---
    this.timerText = this.add
      .text(400, 16, "", { fontSize: "20px", color: "#ffffff" })
      .setScrollFactor(0)
      .setOrigin(0.5, 0)
      .setDepth(50);

    this.statsText = this.add
      .text(10, 10, "", { fontSize: "14px", color: "#a0a0cc" })
      .setScrollFactor(0)
      .setDepth(50);

    const bestF = this.trainer.bestFitness === -Infinity ? "--" : this.trainer.bestFitness;
    this.genText = this.add
      .text(790, 10, `Gen: ${this.trainer.generation + 1}  Best: ${bestF}`, {
        fontSize: "14px",
        color: "#a0a0cc",
      })
      .setScrollFactor(0)
      .setOrigin(1, 0)
      .setDepth(50);

    // Intercept bot shots to count shotsFired
    const originalShoot = this.bot.shoot.bind(this.bot);
    this.bot.shoot = (time) => {
      const beforeCount = this.countActiveBullets(this.bot.bullets);
      originalShoot(time);
      const afterCount = this.countActiveBullets(this.bot.bullets);
      if (afterCount > beforeCount) {
        this.stats.shotsFired++;
      }
    };

    this.matchStartTime = this.time.now;
  }

  countActiveBullets(group) {
    let count = 0;
    group.children.each((b) => {
      if (b.active) count++;
    });
    return count;
  }

  respawnEntity(entity) {
    this.time.delayedCall(1500, () => {
      if (this.matchOver) return;
      const margin = 100;
      const x = Phaser.Math.Between(margin, ARENA_W - margin);
      const y = Phaser.Math.Between(margin, ARENA_H - margin);
      entity.respawn(x, y);
    });
  }

  update(time) {
    if (this.matchOver) return;

    // Timer
    const elapsed = time - this.matchStartTime;
    const remaining = Math.max(0, MATCH_DURATION - elapsed);
    const sec = Math.ceil(remaining / 1000);
    const min = Math.floor(sec / 60);
    const s = sec % 60;
    this.timerText.setText(`${min}:${s.toString().padStart(2, "0")}`);

    // Time's up
    if (remaining <= 0) {
      this.endMatch();
      return;
    }

    // Color timer red in last 10s
    if (sec <= 10) {
      this.timerText.setColor("#e94560");
    }

    this.player.update(time);

    // Bot driven by neural net controller (not rule-based update)
    this.controller.update(time);

    // Live stats HUD
    const acc =
      this.stats.shotsFired > 0
        ? ((this.stats.shotsHit / this.stats.shotsFired) * 100).toFixed(0)
        : "0";
    this.statsText.setText(
      [
        `Bot K/D: ${this.stats.botKills}/${this.stats.botDeaths}`,
        `Dmg Dealt: ${this.stats.damageDealt}`,
        `Accuracy: ${acc}%`,
      ].join("\n")
    );
  }

  async endMatch() {
    this.matchOver = true;

    // Stop entities
    if (this.player.alive) this.player.body.setVelocity(0, 0);
    if (this.bot.alive) this.bot.body.setVelocity(0, 0);

    const fitness = this.calculateFitness();

    // Submit to Trainer (updates population, saves best to server)
    await this.trainer.submitResult(fitness, this.brain);

    // Store results for external access
    this.trainingResult = {
      stats: { ...this.stats },
      fitness,
      brain: this.brain,
    };

    this.showResults(fitness);
  }

  calculateFitness() {
    const { botKills, botDeaths, damageDealt } = this.stats;
    return botKills * 100 + damageDealt - botDeaths * 50;
  }

  showResults(fitness) {
    // Overlay
    this.add
      .rectangle(400, 300, 800, 600, 0x000000, 0.85)
      .setScrollFactor(0)
      .setOrigin(0.5)
      .setDepth(100);

    this.add
      .text(400, 25, "Training Complete", {
        fontSize: "36px",
        color: "#ffffff",
        fontStyle: "bold",
      })
      .setScrollFactor(0)
      .setOrigin(0.5)
      .setDepth(101);

    const bestF = this.trainer.bestFitness === -Infinity ? "--" : this.trainer.bestFitness;
    this.add
      .text(400, 60, `Generation ${this.trainer.generation}  |  Best Fitness: ${bestF}`, {
        fontSize: "14px",
        color: "#00ccff",
      })
      .setScrollFactor(0)
      .setOrigin(0.5)
      .setDepth(101);

    // ── Left column: match stats ────────────────────────────

    const leftX = 200;

    // Stats panel bg
    const panelGfx = this.add.graphics().setScrollFactor(0).setDepth(101);
    panelGfx.fillStyle(0x111133, 0.7);
    panelGfx.fillRoundedRect(15, 82, 370, 220, 6);
    panelGfx.lineStyle(1, 0x333366, 0.5);
    panelGfx.strokeRoundedRect(15, 82, 370, 220, 6);

    this.add
      .text(leftX, 92, "Match Stats", {
        fontSize: "15px",
        color: "#ffffff",
        fontStyle: "bold",
      })
      .setScrollFactor(0)
      .setOrigin(0.5, 0)
      .setDepth(102);

    const acc =
      this.stats.shotsFired > 0
        ? ((this.stats.shotsHit / this.stats.shotsFired) * 100).toFixed(1)
        : "0.0";

    const lines = [
      `Bot Kills:       ${this.stats.botKills}`,
      `Bot Deaths:      ${this.stats.botDeaths}`,
      `Damage Dealt:    ${this.stats.damageDealt}`,
      `Damage Taken:    ${this.stats.damageTaken}`,
      `Shots Fired:     ${this.stats.shotsFired}`,
      `Shots Hit:       ${this.stats.shotsHit}`,
      `Accuracy:        ${acc}%`,
    ];

    this.add
      .text(leftX, 190, lines.join("\n"), {
        fontSize: "14px",
        color: "#a0a0cc",
        fontFamily: "monospace",
        lineSpacing: 4,
      })
      .setScrollFactor(0)
      .setOrigin(0.5)
      .setDepth(102);

    // Fitness score
    const fitnessColor =
      fitness > 200 ? "#00ff66" : fitness > 0 ? "#ffcc00" : "#e94560";

    this.add
      .text(leftX, 270, `Fitness: ${fitness}`, {
        fontSize: "20px",
        color: fitnessColor,
        fontStyle: "bold",
      })
      .setScrollFactor(0)
      .setOrigin(0.5, 0)
      .setDepth(102);

    // ── Right column: version history ───────────────────────

    const rightX = 600;

    panelGfx.fillStyle(0x111133, 0.7);
    panelGfx.fillRoundedRect(415, 82, 370, 220, 6);
    panelGfx.lineStyle(1, 0x333366, 0.5);
    panelGfx.strokeRoundedRect(415, 82, 370, 220, 6);

    this.add
      .text(rightX, 92, "Version History", {
        fontSize: "15px",
        color: "#ffffff",
        fontStyle: "bold",
      })
      .setScrollFactor(0)
      .setOrigin(0.5, 0)
      .setDepth(102);

    this.versionHistoryItems = [];
    this.versionStatusText = this.add
      .text(rightX, 200, "Loading...", {
        fontSize: "13px",
        color: "#666688",
      })
      .setScrollFactor(0)
      .setOrigin(0.5)
      .setDepth(102);

    this.fetchVersionHistory();

    // ── Bottom buttons ──────────────────────────────────────

    const trainBtn = this.add
      .text(300, 560, "[ Train Again ]", {
        fontSize: "24px",
        color: "#00ccff",
      })
      .setScrollFactor(0)
      .setOrigin(0.5)
      .setDepth(101)
      .setInteractive({ useHandCursor: true });

    trainBtn.on("pointerover", () => trainBtn.setColor("#ffffff"));
    trainBtn.on("pointerout", () => trainBtn.setColor("#00ccff"));
    trainBtn.on("pointerdown", () => this.trainAgain());

    const saveBtn = this.add
      .text(500, 560, "[ Save & Exit ]", {
        fontSize: "24px",
        color: "#00ff66",
      })
      .setScrollFactor(0)
      .setOrigin(0.5)
      .setDepth(101)
      .setInteractive({ useHandCursor: true });

    saveBtn.on("pointerover", () => saveBtn.setColor("#ffffff"));
    saveBtn.on("pointerout", () => saveBtn.setColor("#00ff66"));
    saveBtn.on("pointerdown", () => this.saveAndExit());
  }

  // ── Version History ─────────────────────────────────────

  async fetchVersionHistory() {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_URL}/ai/weights/history`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to load");
      const data = await res.json();
      this.renderVersionHistory(data.versions.slice(0, 5));
    } catch {
      if (this.versionStatusText) {
        this.versionStatusText.setText("Could not load version history.");
      }
    }
  }

  renderVersionHistory(versions) {
    if (this.versionStatusText) {
      this.versionStatusText.destroy();
      this.versionStatusText = null;
    }

    // Clean up any previous items
    for (const item of this.versionHistoryItems) {
      item.destroy();
    }
    this.versionHistoryItems = [];

    if (versions.length === 0) {
      const t = this.add
        .text(600, 180, "No saved versions yet.", {
          fontSize: "13px",
          color: "#666688",
        })
        .setScrollFactor(0)
        .setOrigin(0.5)
        .setDepth(102);
      this.versionHistoryItems.push(t);
      return;
    }

    const startY = 116;
    const rowH = 36;

    // Column headers
    const header = this.add
      .text(435, startY, "Ver   Fitness         Saved", {
        fontSize: "11px",
        color: "#666688",
        fontFamily: "monospace",
      })
      .setScrollFactor(0)
      .setDepth(102);
    this.versionHistoryItems.push(header);

    versions.forEach((ver, i) => {
      const y = startY + 18 + i * rowH;
      const isLatest = i === 0;
      const fitnessStr = ver.fitness != null ? ver.fitness.toString() : "--";
      const fitnessColor =
        ver.fitness != null
          ? ver.fitness > 200
            ? "#00ff66"
            : ver.fitness > 0
              ? "#ffcc00"
              : "#e94560"
          : "#666688";

      const date = new Date(ver.created_at);
      const timeStr = `${date.getMonth() + 1}/${date.getDate()} ${date.getHours()}:${date.getMinutes().toString().padStart(2, "0")}`;

      // Version number
      const verText = this.add
        .text(435, y, `v${ver.version}`, {
          fontSize: "13px",
          color: isLatest ? "#00ccff" : "#a0a0cc",
          fontStyle: isLatest ? "bold" : "normal",
        })
        .setScrollFactor(0)
        .setDepth(102);
      this.versionHistoryItems.push(verText);

      // Fitness
      const fitText = this.add
        .text(480, y, fitnessStr, {
          fontSize: "13px",
          color: fitnessColor,
        })
        .setScrollFactor(0)
        .setDepth(102);
      this.versionHistoryItems.push(fitText);

      // Timestamp
      const timeText = this.add
        .text(560, y, timeStr, {
          fontSize: "11px",
          color: "#555577",
        })
        .setScrollFactor(0)
        .setDepth(102);
      this.versionHistoryItems.push(timeText);

      // Rollback button (not for latest version)
      if (!isLatest) {
        const rbBtn = this.add
          .text(690, y, "Rollback", {
            fontSize: "12px",
            color: "#e94560",
          })
          .setScrollFactor(0)
          .setOrigin(0, 0)
          .setDepth(102)
          .setInteractive({ useHandCursor: true });
        this.versionHistoryItems.push(rbBtn);

        rbBtn.on("pointerover", () => rbBtn.setColor("#ff6680"));
        rbBtn.on("pointerout", () => rbBtn.setColor("#e94560"));
        rbBtn.on("pointerdown", () => this.rollbackToVersion(ver.version));
      } else {
        const badge = this.add
          .text(690, y, "current", {
            fontSize: "11px",
            color: "#00ccff",
          })
          .setScrollFactor(0)
          .setDepth(102);
        this.versionHistoryItems.push(badge);
      }
    });
  }

  async rollbackToVersion(version) {
    // Disable further rollbacks while in progress
    for (const item of this.versionHistoryItems) {
      item.disableInteractive?.();
    }

    const statusText = this.add
      .text(600, 290, "Rolling back...", {
        fontSize: "13px",
        color: "#ffcc00",
      })
      .setScrollFactor(0)
      .setOrigin(0.5)
      .setDepth(103);

    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_URL}/ai/weights/rollback/${version}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Rollback failed");
      }

      const data = await res.json();
      statusText.setText(`Rolled back to v${version} (now v${data.version})`);
      statusText.setColor("#00ff66");

      // Refresh the history panel
      this.time.delayedCall(800, () => {
        statusText.destroy();
        this.fetchVersionHistory();
      });
    } catch (err) {
      statusText.setText(err.message);
      statusText.setColor("#e94560");
      this.time.delayedCall(2000, () => statusText.destroy());
    }
  }

  trainAgain() {
    this.brain.dispose();
    this.scene.restart();
  }

  saveAndExit() {
    // Trainer already saved best weights to server in submitResult()
    this.brain.dispose();
    this.scene.start("MenuScene");
  }

  // --- Arena setup (mirrors GameScene) ---

  generateTextures() {
    if (!this.textures.exists("bullet")) {
      const g = this.make.graphics({ add: false });
      g.fillStyle(0xffff00);
      g.fillCircle(4, 4, 4);
      g.generateTexture("bullet", 8, 8);
      g.destroy();
    }
    if (!this.textures.exists("floor")) {
      const g = this.make.graphics({ add: false });
      g.fillStyle(0x111122);
      g.fillRect(0, 0, 80, 80);
      g.lineStyle(1, 0x1a1a3e, 0.6);
      g.strokeRect(0, 0, 80, 80);
      g.fillStyle(0x1a1a3e, 0.8);
      g.fillCircle(0, 0, 2);
      g.fillCircle(80, 0, 2);
      g.fillCircle(0, 80, 2);
      g.fillCircle(80, 80, 2);
      g.generateTexture("floor", 80, 80);
      g.destroy();
    }
    if (!this.textures.exists("obstacle")) {
      const g = this.make.graphics({ add: false });
      g.fillStyle(0xffffff);
      g.fillRect(0, 0, 4, 4);
      g.generateTexture("obstacle", 4, 4);
      g.destroy();
    }
    if (!this.textures.exists("wall")) {
      const g = this.make.graphics({ add: false });
      g.fillStyle(0xffffff);
      g.fillRect(0, 0, 4, 4);
      g.generateTexture("wall", 4, 4);
      g.destroy();
    }
  }

  createWalls() {
    const c = 0xe94560;
    this.walls.add(this.add.tileSprite(ARENA_W / 2, WALL_T / 2, ARENA_W, WALL_T, "wall").setTint(c));
    this.walls.add(this.add.tileSprite(ARENA_W / 2, ARENA_H - WALL_T / 2, ARENA_W, WALL_T, "wall").setTint(c));
    this.walls.add(this.add.tileSprite(WALL_T / 2, ARENA_H / 2, WALL_T, ARENA_H, "wall").setTint(c));
    this.walls.add(this.add.tileSprite(ARENA_W - WALL_T / 2, ARENA_H / 2, WALL_T, ARENA_H, "wall").setTint(c));

    const gfx = this.add.graphics().setDepth(1);
    gfx.lineStyle(2, 0xe94560, 0.4);
    gfx.strokeRect(WALL_T, WALL_T, ARENA_W - WALL_T * 2, ARENA_H - WALL_T * 2);
  }

  createObstacles() {
    const count = Phaser.Math.Between(12, 18);
    const cx = ARENA_W / 2;
    const cy = ARENA_H / 2;
    const placed = [];
    const margin = WALL_T + 40;

    for (let n = 0; n < count; n++) {
      const w = Phaser.Math.Between(40, 120);
      const h = Phaser.Math.Between(40, 120);
      let x, y, tries = 0;
      do {
        x = Phaser.Math.Between(margin + w / 2, ARENA_W - margin - w / 2);
        y = Phaser.Math.Between(margin + h / 2, ARENA_H - margin - h / 2);
        tries++;
      } while (tries < 50 && !this.isValidPlacement(x, y, w, h, cx, cy, placed));

      if (tries >= 50) continue;
      placed.push({ x, y, w, h });

      this.obstacles.add(this.add.tileSprite(x, y, w, h, "obstacle").setTint(0x2a2a4e));
      const border = this.add.graphics().setDepth(1);
      border.lineStyle(1, 0x3a3a6e, 0.8);
      border.strokeRect(x - w / 2, y - h / 2, w, h);
      border.lineStyle(2, 0x4a4a8e, 0.5);
      border.lineBetween(x - w / 2, y - h / 2, x + w / 2, y - h / 2);
    }
  }

  isValidPlacement(x, y, w, h, cx, cy, placed) {
    if (Math.abs(x - cx) < SPAWN_CLEAR + w / 2 && Math.abs(y - cy) < SPAWN_CLEAR + h / 2) return false;
    const pad = 30;
    for (const p of placed) {
      if (Math.abs(x - p.x) < (w + p.w) / 2 + pad && Math.abs(y - p.y) < (h + p.h) / 2 + pad) return false;
    }
    return true;
  }
}
