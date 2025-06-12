import Phaser from 'phaser';
import BootScene from './BootScene';
import GameScene from './GameScene';

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: 800,
  height: 600,
  parent: 'game',
  scene: [BootScene, GameScene],
};

new Phaser.Game(config);

if (import.meta.hot) {
  import.meta.hot.accept(() => {
    console.log('HMR');
  });
}
