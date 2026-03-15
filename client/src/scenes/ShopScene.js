import Phaser from "phaser";

const API_URL = "http://localhost:3000";

const CARD_W = 230;
const CARD_H = 150;
const CARD_PAD = 15;
const COLS = 3;
const START_X = 55;
const START_Y = 110;

const COLORS = {
  cardBg: 0x16213e,
  cardBorder: 0x0f3460,
  ownedBorder: 0x00ff66,
  tabActive: 0x0f3460,
  tabInactive: 0x111122,
  buyBtn: 0x0f3460,
  buyBtnHover: 0x1a4a8a,
  buyDisabled: 0x333333,
  owned: 0x00ff66,
};

export default class ShopScene extends Phaser.Scene {
  constructor() {
    super("ShopScene");
  }

  async create() {
    this.currency = 0;
    this.items = [];
    this.activeTab = "player";
    this.cardObjects = [];
    this.purchasing = false;

    // Title
    this.add
      .text(400, 30, "Shop", {
        fontSize: "36px",
        color: "#ffffff",
        fontStyle: "bold",
      })
      .setOrigin(0.5);

    // Currency display
    this.currencyText = this.add
      .text(780, 20, "", { fontSize: "18px", color: "#ffcc00" })
      .setOrigin(1, 0);

    // Back button
    const backBtn = this.add
      .text(20, 20, "< Back", { fontSize: "18px", color: "#a0a0cc" })
      .setInteractive({ useHandCursor: true });
    backBtn.on("pointerover", () => backBtn.setColor("#ffffff"));
    backBtn.on("pointerout", () => backBtn.setColor("#a0a0cc"));
    backBtn.on("pointerdown", () => this.scene.start("MenuScene"));

    // Tabs
    this.createTabs();

    // Loading
    this.loadingText = this.add
      .text(400, 350, "Loading...", { fontSize: "20px", color: "#a0a0cc" })
      .setOrigin(0.5);

    await this.fetchItems();
    this.loadingText.destroy();
    this.renderCards();
  }

  createTabs() {
    this.tabGfx = this.add.graphics();
    this.tabPlayerText = this.add
      .text(250, 75, "Player Upgrades", { fontSize: "16px", color: "#ffffff" })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    this.tabBotText = this.add
      .text(550, 75, "Bot Upgrades", { fontSize: "16px", color: "#a0a0cc" })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });

    this.tabPlayerText.on("pointerdown", () => this.switchTab("player"));
    this.tabBotText.on("pointerdown", () => this.switchTab("bot"));

    this.drawTabs();
  }

  drawTabs() {
    this.tabGfx.clear();

    // Player tab
    this.tabGfx.fillStyle(
      this.activeTab === "player" ? COLORS.tabActive : COLORS.tabInactive
    );
    this.tabGfx.fillRoundedRect(145, 60, 210, 32, 6);
    this.tabPlayerText.setColor(
      this.activeTab === "player" ? "#ffffff" : "#666688"
    );

    // Bot tab
    this.tabGfx.fillStyle(
      this.activeTab === "bot" ? COLORS.tabActive : COLORS.tabInactive
    );
    this.tabGfx.fillRoundedRect(445, 60, 210, 32, 6);
    this.tabBotText.setColor(
      this.activeTab === "bot" ? "#ffffff" : "#666688"
    );

    // Underline active tab
    this.tabGfx.fillStyle(0x00ccff);
    if (this.activeTab === "player") {
      this.tabGfx.fillRect(145, 90, 210, 2);
    } else {
      this.tabGfx.fillRect(445, 90, 210, 2);
    }
  }

  switchTab(tab) {
    if (tab === this.activeTab) return;
    this.activeTab = tab;
    this.drawTabs();
    this.renderCards();
  }

  async fetchItems() {
    try {
      const token = localStorage.getItem("token");
      const headers = { Authorization: `Bearer ${token}` };

      const [itemsRes, meRes] = await Promise.all([
        fetch(`${API_URL}/shop/items`, { headers }),
        fetch(`${API_URL}/auth/me`, { headers }),
      ]);

      const itemsData = await itemsRes.json();
      this.items = itemsData.items || [];

      if (meRes.ok) {
        const meData = await meRes.json();
        this.currency = meData.currency ?? 0;
        // Keep localStorage in sync
        const playerData = JSON.parse(localStorage.getItem("player") || "{}");
        playerData.currency = this.currency;
        localStorage.setItem("player", JSON.stringify(playerData));
      }
    } catch {
      this.items = [];
    }

    this.updateCurrencyDisplay();
  }

  updateCurrencyDisplay() {
    this.currencyText.setText(`${this.currency} coins`);
  }

  clearCards() {
    for (const obj of this.cardObjects) {
      obj.destroy();
    }
    this.cardObjects = [];
  }

  renderCards() {
    this.clearCards();

    const filtered = this.items.filter((item) => item.type === this.activeTab);

    filtered.forEach((item, i) => {
      const col = i % COLS;
      const row = Math.floor(i / COLS);
      const x = START_X + col * (CARD_W + CARD_PAD);
      const y = START_Y + row * (CARD_H + CARD_PAD);

      this.createCard(item, x, y);
    });
  }

  createCard(item, x, y) {
    const gfx = this.add.graphics();
    this.cardObjects.push(gfx);

    const owned = item.purchased;
    const canAfford = this.currency >= item.price;
    const borderColor = owned ? COLORS.ownedBorder : COLORS.cardBorder;

    // Card background
    gfx.fillStyle(COLORS.cardBg);
    gfx.fillRoundedRect(x, y, CARD_W, CARD_H, 8);
    gfx.lineStyle(2, borderColor, owned ? 1 : 0.6);
    gfx.strokeRoundedRect(x, y, CARD_W, CARD_H, 8);

    // Name
    const nameText = this.add
      .text(x + 12, y + 10, item.name, {
        fontSize: "16px",
        color: "#ffffff",
        fontStyle: "bold",
      })
      .setOrigin(0, 0);
    this.cardObjects.push(nameText);

    // Description
    const descText = this.add
      .text(x + 12, y + 32, item.description, {
        fontSize: "11px",
        color: "#8888aa",
        wordWrap: { width: CARD_W - 24 },
      })
      .setOrigin(0, 0);
    this.cardObjects.push(descText);

    // Stat bonus
    const bonusLabel = `${item.stat_key}: x${parseFloat(item.stat_value)}`;
    const statText = this.add
      .text(x + 12, y + 62, bonusLabel, {
        fontSize: "13px",
        color: "#00ccff",
      })
      .setOrigin(0, 0);
    this.cardObjects.push(statText);

    // Price
    const priceText = this.add
      .text(x + 12, y + 84, `${item.price} coins`, {
        fontSize: "13px",
        color: "#ffcc00",
      })
      .setOrigin(0, 0);
    this.cardObjects.push(priceText);

    if (owned) {
      // Owned badge
      const badgeBg = this.add.graphics();
      badgeBg.fillStyle(0x00ff66, 0.15);
      badgeBg.fillRoundedRect(x + CARD_W - 80, y + CARD_H - 38, 68, 26, 4);
      this.cardObjects.push(badgeBg);

      const badge = this.add
        .text(x + CARD_W - 46, y + CARD_H - 25, "Owned", {
          fontSize: "14px",
          color: "#00ff66",
          fontStyle: "bold",
        })
        .setOrigin(0.5);
      this.cardObjects.push(badge);
    } else {
      // Buy button
      const btnX = x + CARD_W - 80;
      const btnY = y + CARD_H - 40;
      const btnW = 68;
      const btnH = 28;

      const btnGfx = this.add.graphics();
      const btnColor = canAfford ? COLORS.buyBtn : COLORS.buyDisabled;
      btnGfx.fillStyle(btnColor);
      btnGfx.fillRoundedRect(btnX, btnY, btnW, btnH, 4);
      this.cardObjects.push(btnGfx);

      const btnText = this.add
        .text(btnX + btnW / 2, btnY + btnH / 2, "Buy", {
          fontSize: "14px",
          color: canAfford ? "#ffffff" : "#666666",
          fontStyle: "bold",
        })
        .setOrigin(0.5);
      this.cardObjects.push(btnText);

      if (canAfford) {
        // Interactive hit zone
        const hitZone = this.add
          .zone(btnX + btnW / 2, btnY + btnH / 2, btnW, btnH)
          .setInteractive({ useHandCursor: true });
        this.cardObjects.push(hitZone);

        hitZone.on("pointerover", () => {
          btnGfx.clear();
          btnGfx.fillStyle(COLORS.buyBtnHover);
          btnGfx.fillRoundedRect(btnX, btnY, btnW, btnH, 4);
        });
        hitZone.on("pointerout", () => {
          btnGfx.clear();
          btnGfx.fillStyle(COLORS.buyBtn);
          btnGfx.fillRoundedRect(btnX, btnY, btnW, btnH, 4);
        });
        hitZone.on("pointerdown", () => this.buyItem(item, gfx, x, y));
      }
    }
  }

  async buyItem(item, cardGfx, x, y) {
    if (this.purchasing) return;
    this.purchasing = true;

    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_URL}/shop/buy/${item.id}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await res.json();

      if (!res.ok) {
        this.showError(data.error || "Purchase failed");
        this.purchasing = false;
        return;
      }

      // Update currency
      this.currency = data.currency;
      const playerData = JSON.parse(localStorage.getItem("player") || "{}");
      playerData.currency = data.currency;
      localStorage.setItem("player", JSON.stringify(playerData));
      this.updateCurrencyDisplay();

      // Mark item as purchased locally
      item.purchased = true;

      // Flash effect
      this.playPurchaseEffect(x, y);

      // Re-render cards after a short delay for the flash to show
      this.time.delayedCall(400, () => {
        this.renderCards();
        this.purchasing = false;
      });
    } catch {
      this.showError("Network error");
      this.purchasing = false;
    }
  }

  playPurchaseEffect(x, y) {
    const cx = x + CARD_W / 2;
    const cy = y + CARD_H / 2;

    // White flash overlay on the card
    const flash = this.add.graphics();
    flash.fillStyle(0xffffff, 0.6);
    flash.fillRoundedRect(x, y, CARD_W, CARD_H, 8);

    this.tweens.add({
      targets: flash,
      alpha: 0,
      duration: 400,
      onComplete: () => flash.destroy(),
    });

    // Expanding ring
    const ring = this.add.graphics();
    ring.lineStyle(3, 0x00ff66, 1);
    ring.strokeCircle(0, 0, 20);
    ring.setPosition(cx, cy);

    this.tweens.add({
      targets: ring,
      scaleX: 3,
      scaleY: 3,
      alpha: 0,
      duration: 500,
      ease: "Cubic.easeOut",
      onComplete: () => ring.destroy(),
    });

    // Rising "+Owned" text
    const plusText = this.add
      .text(cx, cy, "Purchased!", {
        fontSize: "18px",
        color: "#00ff66",
        fontStyle: "bold",
      })
      .setOrigin(0.5);

    this.tweens.add({
      targets: plusText,
      y: cy - 50,
      alpha: 0,
      duration: 800,
      ease: "Cubic.easeOut",
      onComplete: () => plusText.destroy(),
    });

    // Sparkle particles (small squares)
    for (let i = 0; i < 8; i++) {
      const angle = (Math.PI * 2 * i) / 8;
      const spark = this.add.rectangle(
        cx,
        cy,
        4,
        4,
        Phaser.Math.Between(0, 1) ? 0x00ff66 : 0xffcc00
      );
      this.tweens.add({
        targets: spark,
        x: cx + Math.cos(angle) * 60,
        y: cy + Math.sin(angle) * 60,
        alpha: 0,
        scaleX: 0,
        scaleY: 0,
        duration: 500,
        ease: "Cubic.easeOut",
        onComplete: () => spark.destroy(),
      });
    }
  }

  showError(msg) {
    const errText = this.add
      .text(400, 560, msg, {
        fontSize: "16px",
        color: "#e94560",
        fontStyle: "bold",
      })
      .setOrigin(0.5);

    this.tweens.add({
      targets: errText,
      alpha: 0,
      duration: 2000,
      delay: 1000,
      onComplete: () => errText.destroy(),
    });
  }
}
