import Phaser from "phaser";
import Player from "../entities/Player.js";

const ARENA_W = 1600;
const ARENA_H = 1600;

export default class GameScene extends Phaser.Scene {
  constructor() {
    super("GameScene");
  }

  create() {
    // Generate bullet texture (circle)
    if (!this.textures.exists("bullet")) {
      const gfx = this.make.graphics({ add: false });
      gfx.fillStyle(0xffff00);
      gfx.fillCircle(4, 4, 4);
      gfx.generateTexture("bullet", 8, 8);
      gfx.destroy();
    }

    // Physics world bounds
    this.physics.world.setBounds(0, 0, ARENA_W, ARENA_H);

    // Draw arena background grid
    this.drawArena();

    // Spawn player at center
    this.player = new Player(this, ARENA_W / 2, ARENA_H / 2);

    // Camera follows player
    this.cameras.main.setBounds(0, 0, ARENA_W, ARENA_H);
    this.cameras.main.startFollow(this.player, true, 0.1, 0.1);

    // Prevent right-click context menu
    this.input.mouse.disableContextMenu();
  }

  update(time) {
    this.player.update(time);
  }

  drawArena() {
    const gfx = this.add.graphics();

    // Floor
    gfx.fillStyle(0x111122);
    gfx.fillRect(0, 0, ARENA_W, ARENA_H);

    // Grid lines
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

    // Border
    gfx.lineStyle(3, 0xe94560, 1);
    gfx.strokeRect(0, 0, ARENA_W, ARENA_H);
  }
}
