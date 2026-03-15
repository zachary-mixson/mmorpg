import Phaser from "phaser";
import Bullet from "./Bullet.js";
import {
  muzzleFlash,
  deathExplosion,
  damageNumber,
  bulletImpact,
  lerpHealthBar,
} from "../utils/GameFeel.js";

const DEFAULTS = {
  moveSpeed: 150,
  maxHealth: 100,
  bulletDamage: 15,
  fireRate: 400,
  attackRange: 400,
  approachDist: 200,
  aimThreshold: Phaser.Math.DegToRad(15),
  strafeInterval: 2000,
};

export default class Bot extends Phaser.GameObjects.Container {
  constructor(scene, x, y, target, stats = {}, onDeath = null) {
    super(scene, x, y);

    this.target = target;
    this.onDeath = onDeath;

    this.moveSpeed = stats.moveSpeed ?? DEFAULTS.moveSpeed;
    this.maxHealth = stats.maxHealth ?? DEFAULTS.maxHealth;
    this.health = this.maxHealth;
    this.bulletDamage = stats.bulletDamage ?? DEFAULTS.bulletDamage;
    this.fireRate = stats.fireRate ?? DEFAULTS.fireRate;
    this.attackRange = stats.attackRange ?? DEFAULTS.attackRange;
    this.approachDist = stats.approachDist ?? DEFAULTS.approachDist;
    this.aimThreshold = stats.aimThreshold ?? DEFAULTS.aimThreshold;
    this.strafeInterval = stats.strafeInterval ?? DEFAULTS.strafeInterval;

    this.alive = true;
    this.lastFired = 0;
    this.strafeDir = 0; // -1 left, 0 none, 1 right
    this.nextStrafeChange = 0;
    this.hpDisplayPct = 1;

    // Bot body — red rectangle
    this.body_sprite = scene.add.rectangle(0, 0, 32, 32, 0xff4444);
    this.add(this.body_sprite);

    // Barrel
    this.barrel = scene.add.rectangle(18, 0, 14, 6, 0xaa2222);
    this.add(this.barrel);

    // Health bar
    this.hpBarBg = scene.add.rectangle(0, -28, 36, 5, 0x333333);
    this.add(this.hpBarBg);
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
    for (let i = 0; i < 20; i++) {
      const b = new Bullet(scene, 0, 0);
      this.bullets.add(b, true);
      b.body.enable = false;
      b.setActive(false);
      b.setVisible(false);
    }
  }

  update(time) {
    if (!this.alive || !this.target || !this.target.alive) {
      this.body.setVelocity(0, 0);
      return;
    }

    const dx = this.target.x - this.x;
    const dy = this.target.y - this.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const angleToTarget = Math.atan2(dy, dx);

    // Rotate toward target
    this.rotation = Phaser.Math.Angle.RotateTo(
      this.rotation,
      angleToTarget,
      0.08
    );

    // Movement
    let vx = 0;
    let vy = 0;

    // Approach if too far
    if (dist > this.approachDist) {
      vx = Math.cos(angleToTarget) * this.moveSpeed;
      vy = Math.sin(angleToTarget) * this.moveSpeed;
    }

    // Strafe randomly
    if (time > this.nextStrafeChange) {
      this.strafeDir = Phaser.Math.Between(-1, 1);
      this.nextStrafeChange = time + this.strafeInterval;
    }

    if (this.strafeDir !== 0) {
      const strafeAngle = angleToTarget + (Math.PI / 2) * this.strafeDir;
      vx += Math.cos(strafeAngle) * this.moveSpeed * 0.5;
      vy += Math.sin(strafeAngle) * this.moveSpeed * 0.5;
    }

    this.body.setVelocity(vx, vy);

    // Shoot if aimed and in range
    const angleDiff = Math.abs(
      Phaser.Math.Angle.Wrap(this.rotation - angleToTarget)
    );
    if (angleDiff < this.aimThreshold && dist < this.attackRange) {
      this.shoot(time);
    }

    // Keep health bar upright
    this.hpBarBg.rotation = -this.rotation;
    this.hpBar.rotation = -this.rotation;
    const barOffsetY = -28;
    this.hpBarBg.setPosition(
      Math.sin(-this.rotation) * barOffsetY,
      Math.cos(-this.rotation) * barOffsetY * -1
    );
    this.hpBar.setPosition(this.hpBarBg.x, this.hpBarBg.y);

    // Smooth health bar lerp
    const targetPct = this.health / this.maxHealth;
    this.hpDisplayPct = lerpHealthBar(this.hpBar, this.hpDisplayPct, targetPct);
  }

  shoot(time) {
    if (!this.alive) return;
    if (time - this.lastFired < this.fireRate) return;
    this.lastFired = time;

    const bullet = this.bullets.getFirstDead(false);
    if (!bullet) return;

    const tipX = this.x + Math.cos(this.rotation) * 24;
    const tipY = this.y + Math.sin(this.rotation) * 24;
    bullet.fire(tipX, tipY, this.rotation, this.bulletDamage);
    muzzleFlash(this.scene, tipX, tipY);
  }

  takeDamage(amount) {
    if (!this.alive) return;
    this.health = Math.max(0, this.health - amount);

    // Visual feedback
    damageNumber(this.scene, this.x, this.y - 20, amount);
    bulletImpact(this.scene, this.x, this.y, 0xff6644);

    if (this.health <= 0) this.die();
  }

  die() {
    this.alive = false;
    deathExplosion(this.scene, this.x, this.y, 0xff4444);
    this.body.setVelocity(0, 0);
    this.body.enable = false;
    this.setVisible(false);

    this.bullets.children.each((b) => {
      if (b.active) b.deactivate();
    });

    if (this.onDeath) this.onDeath(this);
  }

  respawn(x, y) {
    this.setPosition(x, y);
    this.health = this.maxHealth;
    this.hpDisplayPct = 1;
    this.hpBar.setScale(1, 1);
    this.hpBar.setFillStyle(0x00ff66);
    this.alive = true;
    this.body.enable = true;
    this.setVisible(true);
  }
}
