import Phaser from "phaser";
import Player from "../entities/Player.js";
import Bot from "../entities/Bot.js";
import { loadStats, toPlayerStats, toBotStats } from "../utils/StatsLoader.js";
import {
  generateFXTextures,
  createThinkingDot,
  slideInOverlay,
  fadeInUI,
  bulletImpact,
} from "../utils/GameFeel.js";

const ARENA_W = 1600;
const ARENA_H = 1600;
const WALL_T = 16;
const SPAWN_CLEAR = 300; // radius around center kept free of obstacles

export default class GameScene extends Phaser.Scene {
  constructor() {
    super("GameScene");
  }

  async create() {
    this.gameOver = false;
    this.ready = false;

    this.generateTextures();
    generateFXTextures(this);

    this.physics.world.setBounds(0, 0, ARENA_W, ARENA_H);

    // Tile-sprite floor
    this.add.tileSprite(0, 0, ARENA_W, ARENA_H, "floor").setOrigin(0, 0);

    // Boundary walls (static group)
    this.walls = this.physics.add.staticGroup();
    this.createWalls();

    // Obstacles (static group)
    this.obstacles = this.physics.add.staticGroup();
    this.createObstacles();

    // Load player stats from server
    const allStats = await loadStats();
    const playerStats = toPlayerStats(allStats.player);
    const { botStats } = toBotStats(allStats.bot);

    // Spawn player & bot
    this.player = new Player(
      this,
      ARENA_W / 2 - 200,
      ARENA_H / 2,
      playerStats,
      () => this.showOutcome("You Lose")
    );

    this.bot = new Bot(
      this,
      ARENA_W / 2 + 200,
      ARENA_H / 2,
      this.player,
      botStats,
      () => this.showOutcome("You Win!")
    );

    // Bot thinking indicator
    createThinkingDot(this, this.bot);

    this.ready = true;

    // Bullet ↔ entity collisions
    this.physics.add.overlap(
      this.player.bullets,
      this.bot,
      this.onBulletHit,
      (bullet) => bullet.active && this.bot.alive,
      this
    );

    this.physics.add.overlap(
      this.bot.bullets,
      this.player,
      this.onBulletHit,
      (bullet) => bullet.active && this.player.alive,
      this
    );

    // Bullet ↔ obstacle collisions (destroy bullet)
    this.physics.add.overlap(
      this.player.bullets,
      this.obstacles,
      this.onBulletObstacle,
      (bullet) => bullet.active,
      this
    );
    this.physics.add.overlap(
      this.bot.bullets,
      this.obstacles,
      this.onBulletObstacle,
      (bullet) => bullet.active,
      this
    );

    // Bullet ↔ wall collisions
    this.physics.add.overlap(
      this.player.bullets,
      this.walls,
      this.onBulletObstacle,
      (bullet) => bullet.active,
      this
    );
    this.physics.add.overlap(
      this.bot.bullets,
      this.walls,
      this.onBulletObstacle,
      (bullet) => bullet.active,
      this
    );

    // Entity ↔ obstacle collisions (can't walk through)
    this.physics.add.collider(this.player, this.obstacles);
    this.physics.add.collider(this.bot, this.obstacles);
    this.physics.add.collider(this.player, this.walls);
    this.physics.add.collider(this.bot, this.walls);

    // Camera
    this.cameras.main.setBounds(0, 0, ARENA_W, ARENA_H);
    this.cameras.main.startFollow(this.player, true, 0.1, 0.1);
    this.input.mouse.disableContextMenu();
  }

  generateTextures() {
    // Bullet
    if (!this.textures.exists("bullet")) {
      const g = this.make.graphics({ add: false });
      g.fillStyle(0xffff00);
      g.fillCircle(4, 4, 4);
      g.generateTexture("bullet", 8, 8);
      g.destroy();
    }

    // Floor tile (80×80 dark grid cell)
    if (!this.textures.exists("floor")) {
      const g = this.make.graphics({ add: false });
      g.fillStyle(0x111122);
      g.fillRect(0, 0, 80, 80);
      g.lineStyle(1, 0x1a1a3e, 0.6);
      g.strokeRect(0, 0, 80, 80);
      // subtle corner dots
      g.fillStyle(0x1a1a3e, 0.8);
      g.fillCircle(0, 0, 2);
      g.fillCircle(80, 0, 2);
      g.fillCircle(0, 80, 2);
      g.fillCircle(80, 80, 2);
      g.generateTexture("floor", 80, 80);
      g.destroy();
    }

    // Obstacle texture (1×1, tinted per-instance)
    if (!this.textures.exists("obstacle")) {
      const g = this.make.graphics({ add: false });
      g.fillStyle(0xffffff);
      g.fillRect(0, 0, 4, 4);
      g.generateTexture("obstacle", 4, 4);
      g.destroy();
    }

    // Wall texture (1×1)
    if (!this.textures.exists("wall")) {
      const g = this.make.graphics({ add: false });
      g.fillStyle(0xffffff);
      g.fillRect(0, 0, 4, 4);
      g.generateTexture("wall", 4, 4);
      g.destroy();
    }
  }

  createWalls() {
    const wallColor = 0xe94560;

    // Top
    const top = this.add
      .tileSprite(ARENA_W / 2, WALL_T / 2, ARENA_W, WALL_T, "wall")
      .setTint(wallColor);
    this.walls.add(top);

    // Bottom
    const bottom = this.add
      .tileSprite(ARENA_W / 2, ARENA_H - WALL_T / 2, ARENA_W, WALL_T, "wall")
      .setTint(wallColor);
    this.walls.add(bottom);

    // Left
    const left = this.add
      .tileSprite(WALL_T / 2, ARENA_H / 2, WALL_T, ARENA_H, "wall")
      .setTint(wallColor);
    this.walls.add(left);

    // Right
    const right = this.add
      .tileSprite(ARENA_W - WALL_T / 2, ARENA_H / 2, WALL_T, ARENA_H, "wall")
      .setTint(wallColor);
    this.walls.add(right);

    // Glow lines on inner edges
    const gfx = this.add.graphics().setDepth(1);
    gfx.lineStyle(2, 0xe94560, 0.4);
    const i = WALL_T;
    gfx.strokeRect(i, i, ARENA_W - i * 2, ARENA_H - i * 2);
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

      let x, y;
      let tries = 0;
      do {
        x = Phaser.Math.Between(margin + w / 2, ARENA_W - margin - w / 2);
        y = Phaser.Math.Between(margin + h / 2, ARENA_H - margin - h / 2);
        tries++;
      } while (tries < 50 && !this.isValidPlacement(x, y, w, h, cx, cy, placed));

      if (tries >= 50) continue;

      placed.push({ x, y, w, h });

      // Obstacle body
      const obs = this.add
        .tileSprite(x, y, w, h, "obstacle")
        .setTint(0x2a2a4e);
      this.obstacles.add(obs);

      // Highlight border
      const border = this.add.graphics().setDepth(1);
      border.lineStyle(1, 0x3a3a6e, 0.8);
      border.strokeRect(x - w / 2, y - h / 2, w, h);
      // Top-edge accent
      border.lineStyle(2, 0x4a4a8e, 0.5);
      border.lineBetween(x - w / 2, y - h / 2, x + w / 2, y - h / 2);
    }
  }

  isValidPlacement(x, y, w, h, cx, cy, placed) {
    // Must not overlap center spawn area
    const dx = Math.abs(x - cx);
    const dy = Math.abs(y - cy);
    if (dx < SPAWN_CLEAR + w / 2 && dy < SPAWN_CLEAR + h / 2) {
      return false;
    }

    // Must not overlap existing obstacles (with padding)
    const pad = 30;
    for (const p of placed) {
      if (
        Math.abs(x - p.x) < (w + p.w) / 2 + pad &&
        Math.abs(y - p.y) < (h + p.h) / 2 + pad
      ) {
        return false;
      }
    }

    return true;
  }

  onBulletHit(bullet, entity) {
    const dmg = bullet.damage;
    const bx = bullet.x;
    const by = bullet.y;
    bullet.deactivate();
    entity.takeDamage(dmg);
  }

  onBulletObstacle(bullet) {
    bulletImpact(this, bullet.x, bullet.y, 0x888888);
    bullet.deactivate();
  }

  showOutcome(message) {
    if (this.gameOver) return;
    this.gameOver = true;

    // Background overlay fades in
    const bg = this.add
      .rectangle(400, 300, 800, 600, 0x000000, 0)
      .setScrollFactor(0)
      .setOrigin(0.5)
      .setDepth(100);
    this.tweens.add({ targets: bg, fillAlpha: 0.7, duration: 300 });

    const color = message.includes("Win") ? "#00ff66" : "#e94560";
    const headline = this.add
      .text(400, 260, message, {
        fontSize: "64px",
        color,
        fontStyle: "bold",
      })
      .setScrollFactor(0)
      .setOrigin(0.5)
      .setDepth(101);

    const restartBtn = this.add
      .text(400, 350, "[ Restart ]", {
        fontSize: "32px",
        color: "#ffffff",
      })
      .setScrollFactor(0)
      .setOrigin(0.5)
      .setDepth(101)
      .setInteractive({ useHandCursor: true });

    restartBtn.on("pointerover", () => restartBtn.setColor("#00ccff"));
    restartBtn.on("pointerout", () => restartBtn.setColor("#ffffff"));
    restartBtn.on("pointerdown", () => this.scene.restart());

    const menuBtn = this.add
      .text(400, 410, "[ Menu ]", {
        fontSize: "24px",
        color: "#a0a0cc",
      })
      .setScrollFactor(0)
      .setOrigin(0.5)
      .setDepth(101)
      .setInteractive({ useHandCursor: true });

    menuBtn.on("pointerover", () => menuBtn.setColor("#e94560"));
    menuBtn.on("pointerout", () => menuBtn.setColor("#a0a0cc"));
    menuBtn.on("pointerdown", () => this.scene.start("MenuScene"));

    // Slide in the overlay elements
    slideInOverlay(this, [headline, restartBtn, menuBtn]);
  }

  update(time) {
    if (!this.ready || this.gameOver) return;
    this.player.update(time);
    this.bot.update(time);
  }
}
