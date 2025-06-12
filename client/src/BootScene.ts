import Phaser from 'phaser';

export default class BootScene extends Phaser.Scene {
  constructor() {
    super('boot');
  }

  preload() {
    // preload assets here
  }

  create() {
    this.scene.start('game');
  }
}
