import Phaser from "phaser";
import Bot from "../entities/Bot.js";
import BotBrain from "../ai/BotBrain.js";
import BotController from "../ai/BotController.js";
import { loadStats, toBotStats } from "../utils/StatsLoader.js";
import { generateFXTextures, createThinkingDot } from "../utils/GameFeel.js";

const API_URL = "http://localhost:3000";
const ARENA_W = 800;
const ARENA_H = 600;
const WALL_T = 12;
const MATCH_DURATION = 60_000; // 60 seconds

export default class WatchBotScene extends Phaser.Scene {
  constructor() {
    super("WatchBotScene");
  }

  async create() {
    this.matchOver = false;
    this.matchStartTime = 0;
    this.kills = { blue: 0, red: 0 };

    this.generateTextures();
    generateFXTextures(this);
    this.physics.world.setBounds(0, 0, ARENA_W, ARENA_H);

    // Floor
    this.add.tileSprite(0, 0, ARENA_W, ARENA_H, "floor").setOrigin(0, 0);

    // Walls
    this.walls = this.physics.add.staticGroup();
    this.createWalls();

    // Loading text
    const loadingText = this.add
      .text(ARENA_W / 2, ARENA_H / 2, "Loading AI...", {
        fontSize: "24px",
        color: "#a0a0cc",
      })
      .setOrigin(0.5)
      .setDepth(200);

    // Fetch bot weights and stats
    let weightsData = null;
    const [allStats] = await Promise.all([
      loadStats(),
      (async () => {
        try {
          const token = localStorage.getItem("token");
          const res = await fetch(`${API_URL}/ai/weights`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          const json = await res.json();
          if (json.weights) weightsData = json.weights;
        } catch {
          // Use random weights
        }
      })(),
    ]);

    loadingText.destroy();

    const { botStats, controllerOptions } = toBotStats(allStats.bot);

    // Create two brains — clones of the same weights
    this.brainA = new BotBrain(weightsData);
    this.brainB = new BotBrain(weightsData);

    // Spawn two bots — blue team and red team
    // Bot A (blue) — targets Bot B
    this.botA = new Bot(
      this,
      ARENA_W / 2 - 150,
      ARENA_H / 2,
      null, // target set after both exist
      botStats,
      () => {
        this.kills.red++;
        this.respawnBot(this.botA);
        this.controllerA.reset();
      }
    );
    this.botA.body_sprite.setFillStyle(0x00ccff);
    this.botA.barrel.setFillStyle(0x0088aa);

    // Bot B (red) — targets Bot A
    this.botB = new Bot(
      this,
      ARENA_W / 2 + 150,
      ARENA_H / 2,
      null,
      botStats,
      () => {
        this.kills.blue++;
        this.respawnBot(this.botB);
        this.controllerB.reset();
      }
    );

    // Set targets cross-referencing
    this.botA.target = this.botB;
    this.botB.target = this.botA;

    // Thinking indicators
    createThinkingDot(this, this.botA);
    createThinkingDot(this, this.botB);

    // Controllers
    this.controllerA = new BotController(this.brainA, this.botA, this.botB, controllerOptions);
    this.controllerB = new BotController(this.brainB, this.botB, this.botA, controllerOptions);

    // ── Collisions ──────────────────────────────────────────

    // Bot A bullets → Bot B
    this.physics.add.overlap(
      this.botA.bullets,
      this.botB,
      (bullet) => {
        if (!bullet.active || !this.botB.alive) return;
        bullet.deactivate();
        this.botB.takeDamage(bullet.damage);
      },
      (bullet) => bullet.active && this.botB.alive,
      this
    );

    // Bot B bullets → Bot A
    this.physics.add.overlap(
      this.botB.bullets,
      this.botA,
      (bullet) => {
        if (!bullet.active || !this.botA.alive) return;
        bullet.deactivate();
        this.botA.takeDamage(bullet.damage);
      },
      (bullet) => bullet.active && this.botA.alive,
      this
    );

    // Bullets → walls
    const destroyBullet = (bullet) => bullet.deactivate();
    const isActive = (bullet) => bullet.active;
    this.physics.add.overlap(this.botA.bullets, this.walls, destroyBullet, isActive, this);
    this.physics.add.overlap(this.botB.bullets, this.walls, destroyBullet, isActive, this);

    // Bots ↔ walls
    this.physics.add.collider(this.botA, this.walls);
    this.physics.add.collider(this.botB, this.walls);

    // Bots ↔ each other
    this.physics.add.collider(this.botA, this.botB);

    // ── HUD ─────────────────────────────────────────────────

    // Spectator label
    this.add
      .text(ARENA_W / 2, 10, "SPECTATOR MODE", {
        fontSize: "14px",
        color: "#666688",
        fontStyle: "bold",
      })
      .setOrigin(0.5, 0);

    // Timer
    this.timerText = this.add
      .text(ARENA_W / 2, 30, "1:00", {
        fontSize: "20px",
        color: "#ffffff",
        fontStyle: "bold",
      })
      .setOrigin(0.5, 0);

    // Blue score (left)
    this.add
      .text(20, 12, "BLUE", {
        fontSize: "14px",
        color: "#00ccff",
        fontStyle: "bold",
      });
    this.blueKillsText = this.add
      .text(20, 32, "Kills: 0", {
        fontSize: "13px",
        color: "#ffffff",
      });

    // Red score (right)
    this.add
      .text(ARENA_W - 20, 12, "RED", {
        fontSize: "14px",
        color: "#ff4444",
        fontStyle: "bold",
      })
      .setOrigin(1, 0);
    this.redKillsText = this.add
      .text(ARENA_W - 20, 32, "Kills: 0", {
        fontSize: "13px",
        color: "#ffffff",
      })
      .setOrigin(1, 0);

    // Back button
    const backBtn = this.add
      .text(ARENA_W / 2, ARENA_H - 20, "[ Back to Menu ]", {
        fontSize: "16px",
        color: "#a0a0cc",
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });

    backBtn.on("pointerover", () => backBtn.setColor("#ffffff"));
    backBtn.on("pointerout", () => backBtn.setColor("#a0a0cc"));
    backBtn.on("pointerdown", () => this.exitToMenu());

    this.matchStartTime = this.time.now;
  }

  respawnBot(bot) {
    this.time.delayedCall(1500, () => {
      if (this.matchOver) return;
      const margin = 60;
      const x = Phaser.Math.Between(margin, ARENA_W - margin);
      const y = Phaser.Math.Between(margin, ARENA_H - margin);
      bot.respawn(x, y);
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

    if (sec <= 10) {
      this.timerText.setColor("#e94560");
    }

    if (remaining <= 0) {
      this.endMatch();
      return;
    }

    // Update both controllers (neural net driven)
    this.controllerA.update(time);
    this.controllerB.update(time);

    // Update kill display
    this.blueKillsText.setText(`Kills: ${this.kills.blue}`);
    this.redKillsText.setText(`Kills: ${this.kills.red}`);
  }

  endMatch() {
    this.matchOver = true;

    if (this.botA.alive) this.botA.body.setVelocity(0, 0);
    if (this.botB.alive) this.botB.body.setVelocity(0, 0);

    // Determine winner
    let headline, headlineColor;
    if (this.kills.blue > this.kills.red) {
      headline = "Blue Bot Wins!";
      headlineColor = "#00ccff";
    } else if (this.kills.red > this.kills.blue) {
      headline = "Red Bot Wins!";
      headlineColor = "#ff4444";
    } else {
      headline = "Draw!";
      headlineColor = "#ffcc00";
    }

    // Overlay
    this.add
      .rectangle(ARENA_W / 2, ARENA_H / 2, ARENA_W, ARENA_H, 0x000000, 0.7)
      .setOrigin(0.5)
      .setDepth(100);

    this.add
      .text(ARENA_W / 2, ARENA_H / 2 - 80, headline, {
        fontSize: "48px",
        color: headlineColor,
        fontStyle: "bold",
      })
      .setOrigin(0.5)
      .setDepth(101);

    this.add
      .text(
        ARENA_W / 2,
        ARENA_H / 2 - 20,
        `Blue: ${this.kills.blue} kills   |   Red: ${this.kills.red} kills`,
        {
          fontSize: "18px",
          color: "#a0a0cc",
        }
      )
      .setOrigin(0.5)
      .setDepth(101);

    // Watch Again
    const watchAgainBtn = this.add
      .text(ARENA_W / 2, ARENA_H / 2 + 40, "[ Watch Again ]", {
        fontSize: "24px",
        color: "#00ff66",
      })
      .setOrigin(0.5)
      .setDepth(101)
      .setInteractive({ useHandCursor: true });

    watchAgainBtn.on("pointerover", () => watchAgainBtn.setColor("#66ffaa"));
    watchAgainBtn.on("pointerout", () => watchAgainBtn.setColor("#00ff66"));
    watchAgainBtn.on("pointerdown", () => {
      this.cleanup();
      this.scene.restart();
    });

    // Back to Menu
    const menuBtn = this.add
      .text(ARENA_W / 2, ARENA_H / 2 + 80, "[ Main Menu ]", {
        fontSize: "20px",
        color: "#a0a0cc",
      })
      .setOrigin(0.5)
      .setDepth(101)
      .setInteractive({ useHandCursor: true });

    menuBtn.on("pointerover", () => menuBtn.setColor("#e94560"));
    menuBtn.on("pointerout", () => menuBtn.setColor("#a0a0cc"));
    menuBtn.on("pointerdown", () => this.exitToMenu());
  }

  exitToMenu() {
    this.cleanup();
    this.scene.start("MenuScene");
  }

  cleanup() {
    if (this.brainA) {
      this.brainA.dispose();
      this.brainA = null;
    }
    if (this.brainB) {
      this.brainB.dispose();
      this.brainB = null;
    }
  }

  // ── Arena ─────────────────────────────────────────────────

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
    this.walls.add(
      this.add.tileSprite(ARENA_W / 2, WALL_T / 2, ARENA_W, WALL_T, "wall").setTint(c)
    );
    this.walls.add(
      this.add.tileSprite(ARENA_W / 2, ARENA_H - WALL_T / 2, ARENA_W, WALL_T, "wall").setTint(c)
    );
    this.walls.add(
      this.add.tileSprite(WALL_T / 2, ARENA_H / 2, WALL_T, ARENA_H, "wall").setTint(c)
    );
    this.walls.add(
      this.add.tileSprite(ARENA_W - WALL_T / 2, ARENA_H / 2, WALL_T, ARENA_H, "wall").setTint(c)
    );

    const gfx = this.add.graphics().setDepth(1);
    gfx.lineStyle(2, 0xe94560, 0.4);
    gfx.strokeRect(WALL_T, WALL_T, ARENA_W - WALL_T * 2, ARENA_H - WALL_T * 2);
  }
}
