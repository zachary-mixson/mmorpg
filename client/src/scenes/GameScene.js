import Phaser from "phaser";
import Player from "../entities/Player.js";
import Bot from "../entities/Bot.js";

const ARENA_W = 1600;
const ARENA_H = 1600;

export default class GameScene extends Phaser.Scene {
  constructor() {
    super("GameScene");
  }

  create() {
    this.gameOver = false;

    // Generate bullet texture
    if (!this.textures.exists("bullet")) {
      const gfx = this.make.graphics({ add: false });
      gfx.fillStyle(0xffff00);
      gfx.fillCircle(4, 4, 4);
      gfx.generateTexture("bullet", 8, 8);
      gfx.destroy();
    }

    this.physics.world.setBounds(0, 0, ARENA_W, ARENA_H);
    this.drawArena();

    // Spawn player
    this.player = new Player(
      this,
      ARENA_W / 2 - 200,
      ARENA_H / 2,
      {},
      () => this.showOutcome("You Lose")
    );

    // Spawn bot
    this.bot = new Bot(
      this,
      ARENA_W / 2 + 200,
      ARENA_H / 2,
      this.player,
      {},
      () => this.showOutcome("You Win!")
    );

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

    // Camera
    this.cameras.main.setBounds(0, 0, ARENA_W, ARENA_H);
    this.cameras.main.startFollow(this.player, true, 0.1, 0.1);
    this.input.mouse.disableContextMenu();
  }

  onBulletHit(bullet, entity) {
    const dmg = bullet.damage;
    bullet.deactivate();
    entity.takeDamage(dmg);
  }

  showOutcome(message) {
    if (this.gameOver) return;
    this.gameOver = true;

    // Dim overlay
    const overlay = this.add
      .rectangle(
        this.cameras.main.scrollX + 400,
        this.cameras.main.scrollY + 300,
        800,
        600,
        0x000000,
        0.7
      )
      .setScrollFactor(0)
      .setOrigin(0.5)
      .setDepth(100);

    const color = message.includes("Win") ? "#00ff66" : "#e94560";
    this.add
      .text(overlay.x, overlay.y - 40, message, {
        fontSize: "64px",
        color,
        fontStyle: "bold",
      })
      .setScrollFactor(0)
      .setOrigin(0.5)
      .setDepth(101);

    const restartBtn = this.add
      .text(overlay.x, overlay.y + 50, "[ Restart ]", {
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
      .text(overlay.x, overlay.y + 110, "[ Menu ]", {
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
  }

  update(time) {
    if (this.gameOver) return;
    this.player.update(time);
    this.bot.update(time);
  }

  drawArena() {
    const gfx = this.add.graphics();

    gfx.fillStyle(0x111122);
    gfx.fillRect(0, 0, ARENA_W, ARENA_H);

    gfx.lineStyle(1, 0x1a1a3e, 0.5);
    const step = 80;
    for (let x = 0; x <= ARENA_W; x += step) {
      gfx.moveTo(x, 0);
      gfx.lineTo(x, ARENA_H);
    }
    for (let y = 0; y <= ARENA_H; y += step) {
      gfx.moveTo(0, y);
      gfx.lineTo(ARENA_W, y);
    }
    gfx.strokePath();

    gfx.lineStyle(3, 0xe94560, 1);
    gfx.strokeRect(0, 0, ARENA_W, ARENA_H);
  }
}
