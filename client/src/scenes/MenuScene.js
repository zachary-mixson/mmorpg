import Phaser from "phaser";
import { clearCache } from "../utils/StatsLoader.js";
import Trainer from "../ai/Trainer.js";

const API_URL = "http://localhost:3000";

export default class MenuScene extends Phaser.Scene {
  constructor() {
    super("MenuScene");
  }

  async create() {
    const player = JSON.parse(localStorage.getItem("player") || "{}");

    // ── Header ──────────────────────────────────────────────

    this.add
      .text(400, 28, "AI Shooter", {
        fontSize: "36px",
        color: "#ffffff",
        fontStyle: "bold",
      })
      .setOrigin(0.5);

    // Username + currency row
    this.add
      .text(400, 68, player.username || "Player", {
        fontSize: "18px",
        color: "#00ccff",
      })
      .setOrigin(0.5);

    this.currencyText = this.add
      .text(400, 90, "", {
        fontSize: "16px",
        color: "#ffcc00",
      })
      .setOrigin(0.5);

    // Fetch fresh currency from server
    this.fetchCurrency(player);

    // ── Divider ─────────────────────────────────────────────

    const divGfx = this.add.graphics();
    divGfx.lineStyle(1, 0x333366, 0.6);
    divGfx.lineBetween(100, 110, 700, 110);

    // ── Navigation Buttons ──────────────────────────────────

    const btnDefs = [
      { label: "TRAIN", color: 0x533483, hoverColor: 0x7744bb, scene: "TrainingScene", x: 200, y: 160 },
      { label: "MULTIPLAYER", color: 0x0f3460, hoverColor: 0x1a5a9a, scene: "MultiplayerScene", x: 600, y: 160 },
      { label: "SHOP", color: 0x6b5b00, hoverColor: 0x9a8400, scene: "ShopScene", x: 200, y: 230 },
      { label: "LOGOUT", color: 0x4a1a2e, hoverColor: 0x7a2a4e, scene: null, x: 600, y: 230 },
    ];

    for (const def of btnDefs) {
      this.createNavButton(def);
    }

    // ── AI Stats Panel ──────────────────────────────────────

    divGfx.lineBetween(100, 280, 700, 280);

    this.add
      .text(400, 296, "AI Overview", {
        fontSize: "20px",
        color: "#ffffff",
        fontStyle: "bold",
      })
      .setOrigin(0.5);

    this.createAIPanel();

    // ── Watch Bot Fight Button ──────────────────────────────

    const watchGfx = this.add.graphics();
    watchGfx.fillStyle(0x1a3a2e, 1);
    watchGfx.fillRoundedRect(250, 520, 300, 44, 8);
    watchGfx.lineStyle(2, 0x00ff66, 0.6);
    watchGfx.strokeRoundedRect(250, 520, 300, 44, 8);

    const watchText = this.add
      .text(400, 542, "Watch Bot Fight", {
        fontSize: "20px",
        color: "#00ff66",
        fontStyle: "bold",
      })
      .setOrigin(0.5);

    const watchZone = this.add
      .zone(400, 542, 300, 44)
      .setInteractive({ useHandCursor: true });

    watchZone.on("pointerover", () => {
      watchGfx.clear();
      watchGfx.fillStyle(0x2a5a4e, 1);
      watchGfx.fillRoundedRect(250, 520, 300, 44, 8);
      watchGfx.lineStyle(2, 0x00ff66, 0.8);
      watchGfx.strokeRoundedRect(250, 520, 300, 44, 8);
      watchText.setColor("#66ffaa");
    });
    watchZone.on("pointerout", () => {
      watchGfx.clear();
      watchGfx.fillStyle(0x1a3a2e, 1);
      watchGfx.fillRoundedRect(250, 520, 300, 44, 8);
      watchGfx.lineStyle(2, 0x00ff66, 0.6);
      watchGfx.strokeRoundedRect(250, 520, 300, 44, 8);
      watchText.setColor("#00ff66");
    });
    watchZone.on("pointerdown", () => {
      this.scene.start("WatchBotScene");
    });
  }

  // ── Nav Button Factory ──────────────────────────────────

  createNavButton({ label, color, hoverColor, scene: targetScene, x, y }) {
    const w = 340;
    const h = 52;
    const bx = x - w / 2;
    const by = y - h / 2;

    const gfx = this.add.graphics();
    gfx.fillStyle(color, 1);
    gfx.fillRoundedRect(bx, by, w, h, 8);

    const text = this.add
      .text(x, y, label, {
        fontSize: "22px",
        color: "#ffffff",
        fontStyle: "bold",
      })
      .setOrigin(0.5);

    const zone = this.add
      .zone(x, y, w, h)
      .setInteractive({ useHandCursor: true });

    zone.on("pointerover", () => {
      gfx.clear();
      gfx.fillStyle(hoverColor, 1);
      gfx.fillRoundedRect(bx, by, w, h, 8);
    });
    zone.on("pointerout", () => {
      gfx.clear();
      gfx.fillStyle(color, 1);
      gfx.fillRoundedRect(bx, by, w, h, 8);
    });
    zone.on("pointerdown", () => {
      if (targetScene) {
        this.scene.start(targetScene);
      } else {
        // Logout
        localStorage.removeItem("token");
        localStorage.removeItem("player");
        clearCache();
        this.scene.start("AuthScene");
      }
    });
  }

  // ── AI Stats Panel ──────────────────────────────────────

  createAIPanel() {
    const trainer = new Trainer();
    const gen = trainer.generation;
    const bestFitness = trainer.bestFitness;
    const pop = trainer.state.population;

    // Left column — stats
    const genStr = gen === 0 ? "No training yet" : `Generation ${gen}`;
    const fitnessStr =
      bestFitness === -Infinity ? "--" : bestFitness.toString();
    const fitnessColor =
      bestFitness > 200 ? "#00ff66" : bestFitness > 0 ? "#ffcc00" : "#a0a0cc";

    // Stats box background
    const panelGfx = this.add.graphics();
    panelGfx.fillStyle(0x111133, 0.8);
    panelGfx.fillRoundedRect(30, 318, 340, 188, 8);
    panelGfx.lineStyle(1, 0x333366, 0.5);
    panelGfx.strokeRoundedRect(30, 318, 340, 188, 8);

    this.add
      .text(50, 330, genStr, {
        fontSize: "16px",
        color: "#00ccff",
        fontStyle: "bold",
      });

    this.add
      .text(50, 354, `Best Fitness: ${fitnessStr}`, {
        fontSize: "15px",
        color: fitnessColor,
      });

    this.add
      .text(50, 376, `Population: ${pop.length}/8`, {
        fontSize: "14px",
        color: "#a0a0cc",
      });

    // Analyze the population to generate a behavior description
    const description = this.describeBotBehavior(gen, bestFitness, pop);

    this.add
      .text(50, 402, description, {
        fontSize: "12px",
        color: "#8888bb",
        wordWrap: { width: 300 },
        lineSpacing: 4,
      });

    // Right column — fitness chart (simple text-based sparkline)
    panelGfx.fillStyle(0x111133, 0.8);
    panelGfx.fillRoundedRect(390, 318, 380, 188, 8);
    panelGfx.lineStyle(1, 0x333366, 0.5);
    panelGfx.strokeRoundedRect(390, 318, 380, 188, 8);

    this.add
      .text(410, 330, "Population Fitness", {
        fontSize: "14px",
        color: "#ffffff",
        fontStyle: "bold",
      });

    if (pop.length === 0) {
      this.add
        .text(580, 412, "Train your bot to see stats here.", {
          fontSize: "13px",
          color: "#666688",
        })
        .setOrigin(0.5);
    } else {
      // Draw simple bar chart of population fitness
      this.drawFitnessChart(pop, 410, 352, 350, 140);
    }
  }

  drawFitnessChart(pop, cx, cy, cw, ch) {
    const sorted = [...pop].sort((a, b) => b.fitness - a.fitness);
    const maxF = Math.max(1, ...sorted.map((p) => Math.abs(p.fitness)));
    const barW = Math.min(36, (cw - 20) / sorted.length - 4);
    const gfx = this.add.graphics();

    const baseline = cy + ch - 20;

    // Zero line
    gfx.lineStyle(1, 0x444466, 0.4);
    gfx.lineBetween(cx, baseline, cx + cw - 10, baseline);

    sorted.forEach((entry, i) => {
      const x = cx + 10 + i * (barW + 4);
      const normalized = entry.fitness / maxF;
      const barH = Math.abs(normalized) * (ch - 40);
      const barColor =
        entry.fitness > 200
          ? 0x00ff66
          : entry.fitness > 0
            ? 0xffcc00
            : 0xe94560;

      if (entry.fitness >= 0) {
        gfx.fillStyle(barColor, 0.8);
        gfx.fillRect(x, baseline - barH, barW, barH);
      } else {
        gfx.fillStyle(barColor, 0.8);
        gfx.fillRect(x, baseline, barW, barH);
      }

      // Fitness label
      this.add
        .text(x + barW / 2, baseline + 6, entry.fitness.toString(), {
          fontSize: "9px",
          color: "#666688",
        })
        .setOrigin(0.5, 0);
    });
  }

  describeBotBehavior(gen, bestFitness, pop) {
    if (gen === 0) {
      return "Your AI hasn't been trained yet. Head to TRAIN to start evolving your bot's neural network.";
    }

    const parts = [];
    parts.push(`Your AI has survived ${gen} training session${gen > 1 ? "s" : ""}`);

    if (pop.length > 0) {
      // Analyze average fitness to determine tendency
      const avgFitness =
        pop.reduce((sum, p) => sum + p.fitness, 0) / pop.length;

      if (bestFitness > 300) {
        parts.push("and has developed strong combat instincts.");
      } else if (bestFitness > 100) {
        parts.push("and is showing promising improvement.");
      } else if (bestFitness > 0) {
        parts.push("and is still learning the basics.");
      } else {
        parts.push("but is struggling to survive. Keep training!");
      }

      // Combat style inference from fitness distribution
      const highFitness = pop.filter((p) => p.fitness > 200).length;
      const lowDeathPop = pop.filter((p) => p.fitness > 0).length;

      if (highFitness >= 4) {
        parts.push("It prefers aggressive close-range combat with high accuracy.");
      } else if (lowDeathPop >= 6) {
        parts.push("It favors a cautious approach, prioritizing survival over kills.");
      } else if (gen > 10 && avgFitness > 50) {
        parts.push("It's developing a balanced fighting style with decent evasion.");
      } else if (gen > 5) {
        parts.push("Its neural network is still exploring different strategies.");
      }
    }

    return parts.join(" ");
  }

  // ── Currency Fetch ────────────────────────────────────────

  async fetchCurrency(player) {
    // Show cached value immediately
    this.currencyText.setText(`${player.currency ?? 0} coins`);

    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_URL}/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        const currency = data.currency ?? 0;
        this.currencyText.setText(`${currency} coins`);

        // Keep localStorage in sync
        const pd = JSON.parse(localStorage.getItem("player") || "{}");
        pd.currency = currency;
        localStorage.setItem("player", JSON.stringify(pd));
      }
    } catch {
      // Use cached value
    }
  }
}
