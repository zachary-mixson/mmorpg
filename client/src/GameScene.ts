import Phaser from 'phaser';

export default class GameScene extends Phaser.Scene {
  private square!: Phaser.GameObjects.Rectangle;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private coins!: Phaser.GameObjects.Group;
  private gold = 0;

  constructor() {
    super('game');
  }

  create() {
    this.square = this.add.rectangle(400, 300, 50, 50, 0xff0000);
    this.cursors = this.input.keyboard.createCursorKeys();

    this.coins = this.add.group();
    const coin = this.add.rectangle(200, 300, 20, 20, 0xffff00);
    this.coins.add(coin);
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

    this.coins.getChildren().forEach((coin) => {
      coin.rotation += 0.1;
      const rect = coin.getBounds();
      if (Phaser.Geom.Intersects.RectangleToRectangle(rect, this.square.getBounds())) {
        coin.destroy();
        this.gold += 1;
      }
    });
  }
}
