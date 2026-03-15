import Phaser from "phaser";
import { io } from "socket.io-client";
import { clearCache } from "../utils/StatsLoader.js";

const API_URL = "http://localhost:3000";
const ARENA_W = 1600;
const ARENA_H = 1600;
const WALL_T = 16;
const LERP_SPEED = 0.25;

export default class MultiplayerScene extends Phaser.Scene {
  constructor() {
    super("MultiplayerScene");
  }

  create() {
    this.matchActive = false;
    this.myId = null;
    this.remoteEntities = {}; // socketId → { sprite, hpBar, hpBarBg, barrel, nameText }
    this.botEntities = {};    // socketId → { sprite, hpBar, hpBarBg, barrel }
    this.bulletSprites = [];
    this.serverState = null;
    this.matchEnded = false;

    // Input keys
    this.keys = this.input.keyboard.addKeys({
      w: Phaser.Input.Keyboard.KeyCodes.W,
      a: Phaser.Input.Keyboard.KeyCodes.A,
      s: Phaser.Input.Keyboard.KeyCodes.S,
      d: Phaser.Input.Keyboard.KeyCodes.D,
    });

    this.generateTextures();
    this.showMatchmakingScreen();
    this.connectSocket();
  }

  // ── Textures ──────────────────────────────────────────────

  generateTextures() {
    if (!this.textures.exists("bullet")) {
      const g = this.make.graphics({ add: false });
      g.fillStyle(0xffff00);
      g.fillCircle(4, 4, 4);
      g.generateTexture("bullet", 8, 8);
      g.destroy();
    }

    if (!this.textures.exists("floor")) {
      const g = this.make.graphics({ add: false });
      g.fillStyle(0x111122);
      g.fillRect(0, 0, 80, 80);
      g.lineStyle(1, 0x1a1a3e, 0.6);
      g.strokeRect(0, 0, 80, 80);
      g.fillStyle(0x1a1a3e, 0.8);
      g.fillCircle(0, 0, 2);
      g.fillCircle(80, 0, 2);
      g.fillCircle(0, 80, 2);
      g.fillCircle(80, 80, 2);
      g.generateTexture("floor", 80, 80);
      g.destroy();
    }

    if (!this.textures.exists("wall")) {
      const g = this.make.graphics({ add: false });
      g.fillStyle(0xffffff);
      g.fillRect(0, 0, 4, 4);
      g.generateTexture("wall", 4, 4);
      g.destroy();
    }
  }

  // ── Matchmaking Screen ────────────────────────────────────

  showMatchmakingScreen() {
    this.mmGroup = this.add.group();

    const bg = this.add.rectangle(400, 300, 800, 600, 0x1a1a2e).setOrigin(0.5);
    this.mmGroup.add(bg);

    const title = this.add
      .text(400, 200, "Finding Match...", {
        fontSize: "36px",
        color: "#ffffff",
        fontStyle: "bold",
      })
      .setOrigin(0.5);
    this.mmGroup.add(title);

    // Animated dots
    this.mmDots = title;
    this.mmDotCount = 0;
    this.mmDotTimer = this.time.addEvent({
      delay: 500,
      loop: true,
      callback: () => {
        this.mmDotCount = (this.mmDotCount + 1) % 4;
        title.setText("Finding Match" + ".".repeat(this.mmDotCount));
      },
    });

    this.mmStatusText = this.add
      .text(400, 260, "Connecting to server...", {
        fontSize: "18px",
        color: "#a0a0cc",
      })
      .setOrigin(0.5);
    this.mmGroup.add(this.mmStatusText);

    // Cancel button
    const cancelBtn = this.add
      .text(400, 380, "[ Cancel ]", {
        fontSize: "28px",
        color: "#e94560",
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    this.mmGroup.add(cancelBtn);

    cancelBtn.on("pointerover", () => cancelBtn.setColor("#ff6680"));
    cancelBtn.on("pointerout", () => cancelBtn.setColor("#e94560"));
    cancelBtn.on("pointerdown", () => {
      if (this.socket) {
        this.socket.emit("cancelSearch");
      }
      this.leaveToMenu();
    });
  }

  hideMatchmakingScreen() {
    if (this.mmDotTimer) {
      this.mmDotTimer.destroy();
      this.mmDotTimer = null;
    }
    if (this.mmGroup) {
      this.mmGroup.clear(true, true);
      this.mmGroup = null;
    }
  }

  // ── Socket Connection ─────────────────────────────────────

  connectSocket() {
    const token = localStorage.getItem("token");
    this.socket = io(`${API_URL}/game`, {
      auth: { token },
      transports: ["websocket"],
    });

    this.socket.on("connect", () => {
      if (this.mmStatusText) {
        this.mmStatusText.setText("Waiting for opponent...");
      }
      this.socket.emit("findMatch");
    });

    this.socket.on("waiting", (data) => {
      if (this.mmStatusText) {
        this.mmStatusText.setText(data.message);
      }
    });

    this.socket.on("queueTimeout", (data) => {
      if (this.mmStatusText) {
        this.mmStatusText.setText(data.message);
      }
      this.time.delayedCall(1500, () => this.leaveToMenu());
    });

    this.socket.on("searchCancelled", () => {
      this.leaveToMenu();
    });

    this.socket.on("matchFound", (data) => {
      this.startMatch(data);
    });

    this.socket.on("gameState", (state) => {
      this.serverState = state;
    });

    this.socket.on("matchEnd", (data) => {
      this.showMatchEnd(data);
    });

    this.socket.on("connect_error", (err) => {
      if (this.mmStatusText) {
        this.mmStatusText.setText("Connection failed: " + err.message);
      }
    });
  }

  // ── Match Start ───────────────────────────────────────────

  startMatch(data) {
    this.hideMatchmakingScreen();
    this.matchActive = true;
    this.myId = data.yourId;

    const arenaW = data.arena.width;
    const arenaH = data.arena.height;

    this.physics.world.setBounds(0, 0, arenaW, arenaH);

    // Floor
    this.add.tileSprite(0, 0, arenaW, arenaH, "floor").setOrigin(0, 0);

    // Walls
    this.createWalls(arenaW, arenaH);

    // Create entities for each player
    for (const [sid, pData] of Object.entries(data.players)) {
      const isLocal = sid === this.myId;
      this.createPlayerEntity(sid, pData, isLocal);
    }

    // Create bot entities
    for (const [sid, bData] of Object.entries(data.bots)) {
      const isLocalBot = sid === this.myId;
      this.createBotEntity(sid, bData, isLocalBot);
    }

    // Camera follows local player
    const localEntity = this.remoteEntities[this.myId];
    if (localEntity) {
      this.cameras.main.setBounds(0, 0, arenaW, arenaH);
      this.cameras.main.startFollow(localEntity.sprite, true, 0.1, 0.1);
    }

    this.input.mouse.disableContextMenu();

    // HUD (fixed to camera)
    this.createHUD(data);
  }

  createWalls(arenaW, arenaH) {
    const wallColor = 0xe94560;

    this.add.tileSprite(arenaW / 2, WALL_T / 2, arenaW, WALL_T, "wall").setTint(wallColor);
    this.add.tileSprite(arenaW / 2, arenaH - WALL_T / 2, arenaW, WALL_T, "wall").setTint(wallColor);
    this.add.tileSprite(WALL_T / 2, arenaH / 2, WALL_T, arenaH, "wall").setTint(wallColor);
    this.add.tileSprite(arenaW - WALL_T / 2, arenaH / 2, WALL_T, arenaH, "wall").setTint(wallColor);

    const gfx = this.add.graphics().setDepth(1);
    gfx.lineStyle(2, 0xe94560, 0.4);
    gfx.strokeRect(WALL_T, WALL_T, arenaW - WALL_T * 2, arenaH - WALL_T * 2);
  }

  createPlayerEntity(sid, pData, isLocal) {
    const color = isLocal ? 0x00ccff : 0xff4444;
    const barrelColor = isLocal ? 0x0088aa : 0xaa2222;

    const container = this.add.container(pData.x, pData.y);

    const body = this.add.rectangle(0, 0, 32, 32, color);
    container.add(body);

    const barrel = this.add.rectangle(18, 0, 14, 6, barrelColor);
    container.add(barrel);

    const hpBarBg = this.add.rectangle(0, -28, 36, 5, 0x333333);
    container.add(hpBarBg);
    const hpBar = this.add.rectangle(0, -28, 36, 5, 0x00ff66);
    container.add(hpBar);

    const nameText = this.add
      .text(0, -40, pData.username, {
        fontSize: "10px",
        color: isLocal ? "#00ccff" : "#ff6666",
      })
      .setOrigin(0.5);
    container.add(nameText);

    this.remoteEntities[sid] = {
      sprite: container,
      body,
      barrel,
      hpBar,
      hpBarBg,
      nameText,
      targetX: pData.x,
      targetY: pData.y,
      targetRotation: 0,
      isLocal,
    };
  }

  createBotEntity(sid, bData, isLocalBot) {
    const color = isLocalBot ? 0x0099aa : 0xaa3333;
    const barrelColor = isLocalBot ? 0x006677 : 0x771111;

    const container = this.add.container(bData.x, bData.y);

    const body = this.add.rectangle(0, 0, 28, 28, color);
    container.add(body);

    const barrel = this.add.rectangle(16, 0, 12, 5, barrelColor);
    container.add(barrel);

    const hpBarBg = this.add.rectangle(0, -24, 30, 4, 0x333333);
    container.add(hpBarBg);
    const hpBar = this.add.rectangle(0, -24, 30, 4, 0x00ff66);
    container.add(hpBar);

    const label = this.add
      .text(0, -34, "BOT", {
        fontSize: "8px",
        color: isLocalBot ? "#0099aa" : "#aa3333",
      })
      .setOrigin(0.5);
    container.add(label);

    this.botEntities[sid] = {
      sprite: container,
      body,
      barrel,
      hpBar,
      hpBarBg,
      targetX: bData.x,
      targetY: bData.y,
      targetRotation: 0,
    };
  }

  // ── HUD ───────────────────────────────────────────────────

  createHUD(data) {
    this.hudGroup = this.add.group();

    // Timer
    this.timerText = this.add
      .text(400, 16, "3:00", {
        fontSize: "22px",
        color: "#ffffff",
        fontStyle: "bold",
      })
      .setScrollFactor(0)
      .setOrigin(0.5)
      .setDepth(50);
    this.hudGroup.add(this.timerText);

    // Score display — left side = you, right side = opponent
    const players = Object.entries(data.players);
    const localPlayer = players.find(([sid]) => sid === this.myId);
    const remotePlayer = players.find(([sid]) => sid !== this.myId);

    // Left panel (you)
    this.hudLocalName = this.add
      .text(20, 12, localPlayer ? localPlayer[1].username : "You", {
        fontSize: "14px",
        color: "#00ccff",
        fontStyle: "bold",
      })
      .setScrollFactor(0)
      .setDepth(50);
    this.hudGroup.add(this.hudLocalName);

    this.hudLocalKills = this.add
      .text(20, 30, "Kills: 0", {
        fontSize: "13px",
        color: "#ffffff",
      })
      .setScrollFactor(0)
      .setDepth(50);
    this.hudGroup.add(this.hudLocalKills);

    // Local health bar in HUD
    const lhpBg = this.add
      .rectangle(20, 52, 120, 10, 0x333333)
      .setScrollFactor(0)
      .setOrigin(0, 0.5)
      .setDepth(50);
    this.hudGroup.add(lhpBg);
    this.hudLocalHpBar = this.add
      .rectangle(20, 52, 120, 10, 0x00ff66)
      .setScrollFactor(0)
      .setOrigin(0, 0.5)
      .setDepth(50);
    this.hudGroup.add(this.hudLocalHpBar);

    // Right panel (opponent)
    this.hudRemoteName = this.add
      .text(780, 12, remotePlayer ? remotePlayer[1].username : "Opponent", {
        fontSize: "14px",
        color: "#ff6666",
        fontStyle: "bold",
      })
      .setScrollFactor(0)
      .setOrigin(1, 0)
      .setDepth(50);
    this.hudGroup.add(this.hudRemoteName);

    this.hudRemoteKills = this.add
      .text(780, 30, "Kills: 0", {
        fontSize: "13px",
        color: "#ffffff",
      })
      .setScrollFactor(0)
      .setOrigin(1, 0)
      .setDepth(50);
    this.hudGroup.add(this.hudRemoteKills);

    const rhpBg = this.add
      .rectangle(780, 52, 120, 10, 0x333333)
      .setScrollFactor(0)
      .setOrigin(1, 0.5)
      .setDepth(50);
    this.hudGroup.add(rhpBg);
    this.hudRemoteHpBar = this.add
      .rectangle(780, 52, 120, 10, 0x333333)
      .setScrollFactor(0)
      .setOrigin(1, 0.5)
      .setDepth(50);
    this.hudGroup.add(this.hudRemoteHpBar);
    // We'll set size/color in updateHUD

    // Store IDs for HUD updates
    this.localSid = this.myId;
    this.remoteSid = remotePlayer ? remotePlayer[0] : null;
  }

  updateHUD(state) {
    // Timer
    const secs = Math.ceil(state.timeRemaining / 1000);
    const mins = Math.floor(secs / 60);
    const s = secs % 60;
    this.timerText.setText(`${mins}:${s.toString().padStart(2, "0")}`);

    // Kills
    const localKills = state.scores[this.localSid]?.kills ?? 0;
    const remoteKills = state.scores[this.remoteSid]?.kills ?? 0;
    this.hudLocalKills.setText(`Kills: ${localKills}`);
    this.hudRemoteKills.setText(`Kills: ${remoteKills}`);

    // Health bars
    const localPlayer = state.players[this.localSid];
    const remotePlayer = state.players[this.remoteSid];

    if (localPlayer) {
      const pct = localPlayer.health / localPlayer.maxHealth;
      this.hudLocalHpBar.setScale(pct, 1);
      const r = Math.floor(255 * (1 - pct));
      const g = Math.floor(255 * pct);
      this.hudLocalHpBar.setFillStyle(Phaser.Display.Color.GetColor(r, g, 0));
    }

    if (remotePlayer) {
      const pct = remotePlayer.health / remotePlayer.maxHealth;
      this.hudRemoteHpBar.setScale(pct, 1);
      const r = Math.floor(255 * (1 - pct));
      const g = Math.floor(255 * pct);
      this.hudRemoteHpBar.setFillStyle(Phaser.Display.Color.GetColor(r, g, 0));
    }
  }

  // ── Match End Screen ──────────────────────────────────────

  showMatchEnd(data) {
    this.matchEnded = true;
    this.matchActive = false;

    const myResult = data.results[this.myId];
    const isWin = myResult?.won;
    const isTie = data.tie;

    let headline;
    let headlineColor;
    if (isTie) {
      headline = "Draw!";
      headlineColor = "#ffcc00";
    } else if (isWin) {
      headline = "Victory!";
      headlineColor = "#00ff66";
    } else {
      headline = "Defeat";
      headlineColor = "#e94560";
    }

    // Overlay
    this.add
      .rectangle(400, 300, 800, 600, 0x000000, 0.75)
      .setScrollFactor(0)
      .setOrigin(0.5)
      .setDepth(100);

    this.add
      .text(400, 180, headline, {
        fontSize: "64px",
        color: headlineColor,
        fontStyle: "bold",
      })
      .setScrollFactor(0)
      .setOrigin(0.5)
      .setDepth(101);

    if (data.winner && !isTie) {
      this.add
        .text(400, 240, `Winner: ${data.winner}`, {
          fontSize: "20px",
          color: "#a0a0cc",
        })
        .setScrollFactor(0)
        .setOrigin(0.5)
        .setDepth(101);
    }

    // Stats for both players
    let yPos = 280;
    for (const [sid, result] of Object.entries(data.results)) {
      const isMe = sid === this.myId;
      const label = isMe ? `${result.username} (You)` : result.username;
      const color = isMe ? "#00ccff" : "#ff6666";

      this.add
        .text(400, yPos, `${label}  —  ${result.kills} kills  |  +${result.reward} coins`, {
          fontSize: "16px",
          color,
        })
        .setScrollFactor(0)
        .setOrigin(0.5)
        .setDepth(101);
      yPos += 28;
    }

    // Buttons
    yPos += 20;

    const playAgainBtn = this.add
      .text(400, yPos, "[ Play Again ]", {
        fontSize: "28px",
        color: "#00ccff",
        fontStyle: "bold",
      })
      .setScrollFactor(0)
      .setOrigin(0.5)
      .setDepth(101)
      .setInteractive({ useHandCursor: true });

    playAgainBtn.on("pointerover", () => playAgainBtn.setColor("#66ddff"));
    playAgainBtn.on("pointerout", () => playAgainBtn.setColor("#00ccff"));
    playAgainBtn.on("pointerdown", () => {
      this.cleanupSocket();
      this.scene.restart();
    });

    const menuBtn = this.add
      .text(400, yPos + 50, "[ Main Menu ]", {
        fontSize: "24px",
        color: "#a0a0cc",
      })
      .setScrollFactor(0)
      .setOrigin(0.5)
      .setDepth(101)
      .setInteractive({ useHandCursor: true });

    menuBtn.on("pointerover", () => menuBtn.setColor("#e94560"));
    menuBtn.on("pointerout", () => menuBtn.setColor("#a0a0cc"));
    menuBtn.on("pointerdown", () => this.leaveToMenu());
  }

  // ── Entity Rendering from Server State ────────────────────

  applyServerState(state) {
    // Update player entities
    for (const [sid, pState] of Object.entries(state.players)) {
      const entity = this.remoteEntities[sid];
      if (!entity) continue;

      entity.targetX = pState.x;
      entity.targetY = pState.y;
      entity.targetRotation = pState.rotation;

      // Visibility / alive state
      entity.sprite.setVisible(pState.alive);

      // Per-entity health bar
      if (pState.alive) {
        const pct = pState.health / pState.maxHealth;
        entity.hpBar.setScale(pct, 1);
        const r = Math.floor(255 * (1 - pct));
        const g = Math.floor(255 * pct);
        entity.hpBar.setFillStyle(Phaser.Display.Color.GetColor(r, g, 0));
      }
    }

    // Update bot entities
    for (const [sid, bState] of Object.entries(state.bots)) {
      const entity = this.botEntities[sid];
      if (!entity) continue;

      entity.targetX = bState.x;
      entity.targetY = bState.y;
      entity.targetRotation = bState.rotation;
      entity.sprite.setVisible(bState.alive);

      if (bState.alive) {
        const pct = bState.health / bState.maxHealth;
        entity.hpBar.setScale(pct, 1);
        const r = Math.floor(255 * (1 - pct));
        const g = Math.floor(255 * pct);
        entity.hpBar.setFillStyle(Phaser.Display.Color.GetColor(r, g, 0));
      }
    }

    // Update bullets — sync sprite pool to server bullet list
    this.syncBullets(state.bullets);
  }

  syncBullets(serverBullets) {
    // Reuse existing sprites, create or hide as needed
    const needed = serverBullets.length;

    // Grow pool if needed
    while (this.bulletSprites.length < needed) {
      const s = this.add.circle(0, 0, 4, 0xffff00).setDepth(5);
      this.bulletSprites.push(s);
    }

    for (let i = 0; i < this.bulletSprites.length; i++) {
      if (i < needed) {
        this.bulletSprites[i].setPosition(serverBullets[i].x, serverBullets[i].y);
        this.bulletSprites[i].setVisible(true);
      } else {
        this.bulletSprites[i].setVisible(false);
      }
    }
  }

  lerpEntities() {
    // Lerp all player entities toward their server-target positions
    for (const entity of Object.values(this.remoteEntities)) {
      const s = entity.sprite;
      s.x += (entity.targetX - s.x) * LERP_SPEED;
      s.y += (entity.targetY - s.y) * LERP_SPEED;

      // Lerp rotation (handle wrapping)
      const diff = Phaser.Math.Angle.Wrap(entity.targetRotation - s.rotation);
      s.rotation += diff * LERP_SPEED;

      // Keep health bar upright
      entity.hpBarBg.rotation = -s.rotation;
      entity.hpBar.rotation = -s.rotation;
      entity.nameText.rotation = -s.rotation;
      const barY = -28;
      entity.hpBarBg.setPosition(
        Math.sin(-s.rotation) * barY,
        -Math.cos(-s.rotation) * barY
      );
      entity.hpBar.setPosition(entity.hpBarBg.x, entity.hpBarBg.y);
      entity.nameText.setPosition(
        Math.sin(-s.rotation) * -40,
        -Math.cos(-s.rotation) * -40
      );
    }

    // Lerp bot entities
    for (const entity of Object.values(this.botEntities)) {
      const s = entity.sprite;
      s.x += (entity.targetX - s.x) * LERP_SPEED;
      s.y += (entity.targetY - s.y) * LERP_SPEED;

      const diff = Phaser.Math.Angle.Wrap(entity.targetRotation - s.rotation);
      s.rotation += diff * LERP_SPEED;

      entity.hpBarBg.rotation = -s.rotation;
      entity.hpBar.rotation = -s.rotation;
      const barY = -24;
      entity.hpBarBg.setPosition(
        Math.sin(-s.rotation) * barY,
        -Math.cos(-s.rotation) * barY
      );
      entity.hpBar.setPosition(entity.hpBarBg.x, entity.hpBarBg.y);
    }
  }

  // ── Input Sending ─────────────────────────────────────────

  sendInput() {
    let dx = 0;
    let dy = 0;
    if (this.keys.a.isDown) dx -= 1;
    if (this.keys.d.isDown) dx += 1;
    if (this.keys.w.isDown) dy -= 1;
    if (this.keys.s.isDown) dy += 1;

    // Mouse rotation relative to local player world position
    const localEntity = this.remoteEntities[this.myId];
    if (!localEntity) return;

    const pointer = this.input.activePointer;
    const worldPoint = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
    const rotation = Phaser.Math.Angle.Between(
      localEntity.sprite.x,
      localEntity.sprite.y,
      worldPoint.x,
      worldPoint.y
    );

    const shooting = pointer.isDown && pointer.leftButtonDown();

    this.socket.emit("playerInput", { dx, dy, rotation, shooting });
  }

  // ── Update Loop ───────────────────────────────────────────

  update() {
    if (!this.matchActive || this.matchEnded) return;

    // Process latest server state
    if (this.serverState) {
      this.applyServerState(this.serverState);
      this.updateHUD(this.serverState);
      this.serverState = null;
    }

    // Lerp entities smoothly between server ticks
    this.lerpEntities();

    // Send inputs to server
    this.sendInput();
  }

  // ── Cleanup ───────────────────────────────────────────────

  cleanupSocket() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  leaveToMenu() {
    this.cleanupSocket();
    clearCache();
    this.scene.start("MenuScene");
  }

  shutdown() {
    this.cleanupSocket();
  }
}
