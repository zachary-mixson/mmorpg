import Phaser from "phaser";
import { io } from "socket.io-client";

const socket = io("http://localhost:3000");

socket.on("connect", () => {
  console.log("connected");
});

const config = {
  type: Phaser.AUTO,
  width: 800,
  height: 600,
  backgroundColor: "#1a1a2e",
  scene: {
    preload() {},
    create() {
      this.add
        .text(400, 300, "AI Shooter", {
          fontSize: "48px",
          color: "#ffffff",
        })
        .setOrigin(0.5);
    },
    update() {},
  },
};

new Phaser.Game(config);
