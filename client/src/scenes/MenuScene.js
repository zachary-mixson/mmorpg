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
    playBtn.on("pointerdown", () => this.scene.start("GameScene"));

    const trainBtn = this.add
      .text(400, 340, "[ Train Bot ]", {
        fontSize: "28px",
        color: "#533483",
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });

    trainBtn.on("pointerover", () => trainBtn.setColor("#e94560"));
    trainBtn.on("pointerout", () => trainBtn.setColor("#533483"));
    trainBtn.on("pointerdown", () => this.scene.start("TrainingScene"));

    const shopBtn = this.add
      .text(400, 380, "[ Shop ]", {
        fontSize: "28px",
        color: "#ffcc00",
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });

    shopBtn.on("pointerover", () => shopBtn.setColor("#e94560"));
    shopBtn.on("pointerout", () => shopBtn.setColor("#ffcc00"));
    shopBtn.on("pointerdown", () => this.scene.start("ShopScene"));

    const logoutBtn = this.add
      .text(400, 460, "[ Logout ]", {
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
