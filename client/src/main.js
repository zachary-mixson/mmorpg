import Phaser from "phaser";
import AuthScene from "./scenes/AuthScene.js";
import MenuScene from "./scenes/MenuScene.js";

const config = {
  type: Phaser.AUTO,
  width: 800,
  height: 600,
  backgroundColor: "#1a1a2e",
  parent: "game-container",
  dom: {
    createContainer: true,
  },
  scene: [AuthScene, MenuScene],
};

new Phaser.Game(config);
