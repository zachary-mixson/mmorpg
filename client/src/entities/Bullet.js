import Phaser from "phaser";

export default class Bullet extends Phaser.Physics.Arcade.Sprite {
  static SPEED = 600;
  static LIFESPAN = 1200;

  damage = 20;

  constructor(scene, x, y) {
    super(scene, x, y, "bullet");
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setActive(false);
    this.setVisible(false);
  }

  fire(x, y, angle, damage) {
    this.damage = damage;
    this.setPosition(x, y);
    this.setActive(true);
    this.setVisible(true);
    this.body.enable = true;

    this.setVelocity(
      Math.cos(angle) * Bullet.SPEED,
      Math.sin(angle) * Bullet.SPEED
    );

    this.scene.time.delayedCall(Bullet.LIFESPAN, () => {
      this.deactivate();
    });
  }

  deactivate() {
    this.setActive(false);
    this.setVisible(false);
    this.body.enable = false;
    this.setVelocity(0, 0);
  }
}
