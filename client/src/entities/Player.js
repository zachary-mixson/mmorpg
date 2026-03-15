import Phaser from "phaser";
import Bullet from "./Bullet.js";

const DEFAULTS = {
  moveSpeed: 200,
  maxHealth: 100,
  bulletDamage: 20,
  fireRate: 250,
};

export default class Player extends Phaser.GameObjects.Container {
  constructor(scene, x, y, stats = {}, onDeath = null) {
    super(scene, x, y);

    this.moveSpeed = stats.moveSpeed ?? DEFAULTS.moveSpeed;
    this.maxHealth = stats.maxHealth ?? DEFAULTS.maxHealth;
    this.health = this.maxHealth;
    this.bulletDamage = stats.bulletDamage ?? DEFAULTS.bulletDamage;
    this.fireRate = stats.fireRate ?? DEFAULTS.fireRate;
    this.hasDash = stats.hasDash ?? false;
    this.shieldDuration = stats.shieldDuration ?? 0;
    this.alive = true;
    this.lastFired = 0;
    this.onDeath = onDeath;
    this.dashCooldown = 1500;
    this.lastDash = -this.dashCooldown;
    this.shielded = false;
    this.shieldCooldown = 5000;
    this.lastShield = -this.shieldCooldown;

    // Player body — colored rectangle
    this.body_sprite = scene.add.rectangle(0, 0, 32, 32, 0x00ccff);
    this.add(this.body_sprite);

    // Gun barrel indicator
    this.barrel = scene.add.rectangle(18, 0, 14, 6, 0x0088aa);
    this.add(this.barrel);

    // Health bar background
    this.hpBarBg = scene.add.rectangle(0, -28, 36, 5, 0x333333);
    this.add(this.hpBarBg);

    // Health bar fill
    this.hpBar = scene.add.rectangle(0, -28, 36, 5, 0x00ff66);
    this.add(this.hpBar);

    scene.add.existing(this);
    scene.physics.world.enable(this);
    this.body.setSize(32, 32);
    this.body.setCollideWorldBounds(true);

    // Bullet pool
    this.bullets = scene.physics.add.group({
      classType: Bullet,
      maxSize: 20,
      runChildUpdate: false,
    });

    // Pre-populate pool
    for (let i = 0; i < 20; i++) {
      const b = new Bullet(scene, 0, 0);
      this.bullets.add(b, true);
      b.body.enable = false;
      b.setActive(false);
      b.setVisible(false);
    }

    // Input
    this.keys = scene.input.keyboard.addKeys({
      w: Phaser.Input.Keyboard.KeyCodes.W,
      a: Phaser.Input.Keyboard.KeyCodes.A,
      s: Phaser.Input.Keyboard.KeyCodes.S,
      d: Phaser.Input.Keyboard.KeyCodes.D,
      shift: Phaser.Input.Keyboard.KeyCodes.SHIFT,
      q: Phaser.Input.Keyboard.KeyCodes.Q,
    });

    scene.input.on("pointerdown", (pointer) => {
      if (pointer.leftButtonDown()) this.shoot(scene);
    });

    scene.input.on("pointermove", () => {
      // rotation handled in update
    });
  }

  update(time) {
    if (!this.alive) return;

    // Movement
    let vx = 0;
    let vy = 0;
    if (this.keys.a.isDown) vx -= 1;
    if (this.keys.d.isDown) vx += 1;
    if (this.keys.w.isDown) vy -= 1;
    if (this.keys.s.isDown) vy += 1;

    if (vx !== 0 || vy !== 0) {
      const len = Math.sqrt(vx * vx + vy * vy);
      vx = (vx / len) * this.moveSpeed;
      vy = (vy / len) * this.moveSpeed;
    }

    // Dash (Shift)
    if (
      this.hasDash &&
      Phaser.Input.Keyboard.JustDown(this.keys.shift) &&
      time - this.lastDash >= this.dashCooldown &&
      (vx !== 0 || vy !== 0)
    ) {
      this.lastDash = time;
      const dashMultiplier = 3;
      vx *= dashMultiplier;
      vy *= dashMultiplier;
      // Brief visual flash
      this.body_sprite.setFillStyle(0xffffff);
      this.scene.time.delayedCall(120, () => {
        if (this.alive) this.body_sprite.setFillStyle(0x00ccff);
      });
    }

    // Shield (Q)
    if (
      this.shieldDuration > 0 &&
      Phaser.Input.Keyboard.JustDown(this.keys.q) &&
      !this.shielded &&
      time - this.lastShield >= this.shieldCooldown
    ) {
      this.lastShield = time;
      this.shielded = true;
      this.body_sprite.setFillStyle(0x00ffff);
      this.scene.time.delayedCall(this.shieldDuration, () => {
        this.shielded = false;
        if (this.alive) this.body_sprite.setFillStyle(0x00ccff);
      });
    }

    this.body.setVelocity(vx, vy);

    // Rotation toward mouse
    const pointer = this.scene.input.activePointer;
    const worldPoint = this.scene.cameras.main.getWorldPoint(
      pointer.x,
      pointer.y
    );
    this.rotation = Phaser.Math.Angle.Between(
      this.x,
      this.y,
      worldPoint.x,
      worldPoint.y
    );

    // Hold-to-fire
    if (pointer.isDown && pointer.leftButtonDown()) {
      this.shoot(this.scene, time);
    }

    // Update health bar (keep it upright regardless of container rotation)
    this.hpBarBg.rotation = -this.rotation;
    this.hpBar.rotation = -this.rotation;

    // Position health bar above player in world space
    const barOffsetY = -28;
    this.hpBarBg.setPosition(
      Math.sin(-this.rotation) * barOffsetY,
      Math.cos(-this.rotation) * barOffsetY * -1
    );
    this.hpBar.setPosition(this.hpBarBg.x, this.hpBarBg.y);
  }

  shoot(scene, time = 0) {
    if (!this.alive) return;
    if (time - this.lastFired < this.fireRate) return;
    this.lastFired = time;

    const bullet = this.bullets.getFirstDead(false);
    if (!bullet) return;

    const tipX = this.x + Math.cos(this.rotation) * 24;
    const tipY = this.y + Math.sin(this.rotation) * 24;
    bullet.fire(tipX, tipY, this.rotation, this.bulletDamage);
  }

  takeDamage(amount) {
    if (!this.alive) return;
    const dmg = this.shielded ? Math.floor(amount * 0.25) : amount;
    this.health = Math.max(0, this.health - dmg);

    const pct = this.health / this.maxHealth;
    this.hpBar.setScale(pct, 1);

    // Color shifts from green → red
    const r = Math.floor(255 * (1 - pct));
    const g = Math.floor(255 * pct);
    this.hpBar.setFillStyle(Phaser.Display.Color.GetColor(r, g, 0));

    if (this.health <= 0) this.die();
  }

  die() {
    this.alive = false;
    this.body.setVelocity(0, 0);
    this.body.enable = false;
    this.setVisible(false);

    // Deactivate all live bullets
    this.bullets.children.each((b) => {
      if (b.active) b.deactivate();
    });

    if (this.onDeath) {
      this.onDeath(this);
    } else {
      this.scene.time.delayedCall(2000, () => this.respawn());
    }
  }

  respawn() {
    const bounds = this.scene.physics.world.bounds;
    const margin = 100;
    this.setPosition(
      Phaser.Math.Between(margin, bounds.width - margin),
      Phaser.Math.Between(margin, bounds.height - margin)
    );
    this.health = this.maxHealth;
    this.hpBar.setScale(1, 1);
    this.hpBar.setFillStyle(0x00ff66);
    this.alive = true;
    this.body.enable = true;
    this.setVisible(true);
  }
}
