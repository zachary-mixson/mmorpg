import Phaser from 'phaser';

export default class GameScene extends Phaser.Scene {
  private square!: Phaser.GameObjects.Rectangle;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;

  constructor() {
    super('game');
  }

  create() {
    this.square = this.add.rectangle(400, 300, 50, 50, 0xff0000);
    this.cursors = this.input.keyboard.createCursorKeys();
  }

  update() {
    const speed = 200;
    if (this.cursors.left?.isDown) {
      this.square.x -= (speed * this.game.loop.delta) / 1000;
    } else if (this.cursors.right?.isDown) {
      this.square.x += (speed * this.game.loop.delta) / 1000;
    }

    if (this.cursors.up?.isDown) {
      this.square.y -= (speed * this.game.loop.delta) / 1000;
    } else if (this.cursors.down?.isDown) {
      this.square.y += (speed * this.game.loop.delta) / 1000;
    }
  }
}
