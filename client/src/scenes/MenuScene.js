import Phaser from "phaser";

export default class MenuScene extends Phaser.Scene {
  constructor() {
    super("MenuScene");
  }

  create() {
    const player = JSON.parse(localStorage.getItem("player") || "{}");

    this.add
      .text(400, 100, "AI Shooter", {
        fontSize: "48px",
        color: "#ffffff",
      })
      .setOrigin(0.5);

    this.add
      .text(400, 180, `Welcome, ${player.username || "Player"}!`, {
        fontSize: "24px",
        color: "#a0a0cc",
      })
      .setOrigin(0.5);

    const playBtn = this.add
      .text(400, 300, "[ Play ]", {
        fontSize: "32px",
        color: "#0f3460",
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });

    playBtn.on("pointerover", () => playBtn.setColor("#e94560"));
    playBtn.on("pointerout", () => playBtn.setColor("#0f3460"));

    const logoutBtn = this.add
      .text(400, 380, "[ Logout ]", {
        fontSize: "24px",
        color: "#533483",
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });

    logoutBtn.on("pointerover", () => logoutBtn.setColor("#e94560"));
    logoutBtn.on("pointerout", () => logoutBtn.setColor("#533483"));
    logoutBtn.on("pointerdown", () => {
      localStorage.removeItem("token");
      localStorage.removeItem("player");
      this.scene.start("AuthScene");
    });
  }
}
