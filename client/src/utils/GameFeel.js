import Phaser from "phaser";

/**
 * Generate textures used by game-feel effects.
 * Safe to call multiple times — skips if textures already exist.
 */
export function generateFXTextures(scene) {
  if (!scene.textures.exists("particle")) {
    const g = scene.make.graphics({ add: false });
    g.fillStyle(0xffffff);
    g.fillCircle(3, 3, 3);
    g.generateTexture("particle", 6, 6);
    g.destroy();
  }

  if (!scene.textures.exists("muzzle_flash")) {
    const g = scene.make.graphics({ add: false });
    g.fillStyle(0xffffaa);
    g.fillCircle(8, 8, 8);
    g.fillStyle(0xffffff);
    g.fillCircle(8, 8, 4);
    g.generateTexture("muzzle_flash", 16, 16);
    g.destroy();
  }
}

/**
 * Small, short screen shake when taking damage.
 */
export function screenShake(camera, intensity = 0.004, duration = 80) {
  camera.shake(duration, intensity);
}

/**
 * Bullet impact particle burst (8-12 particles, fade over 300ms).
 */
export function bulletImpact(scene, x, y, color = 0xffff00) {
  const emitter = scene.add.particles(x, y, "particle", {
    speed: { min: 50, max: 150 },
    scale: { start: 0.5, end: 0 },
    alpha: { start: 1, end: 0 },
    lifespan: 300,
    quantity: Phaser.Math.Between(8, 12),
    tint: color,
    emitting: false,
  });
  emitter.setDepth(10);
  emitter.explode();
  scene.time.delayedCall(400, () => emitter.destroy());
}

/**
 * Player/bot death explosion (large burst).
 */
export function deathExplosion(scene, x, y, color = 0xff4444) {
  const emitter = scene.add.particles(x, y, "particle", {
    speed: { min: 80, max: 250 },
    scale: { start: 1.2, end: 0 },
    alpha: { start: 1, end: 0 },
    lifespan: 500,
    quantity: 24,
    tint: [color, 0xffffff, 0xffaa00],
    emitting: false,
  });
  emitter.setDepth(10);
  emitter.explode();
  scene.time.delayedCall(600, () => emitter.destroy());
}

/**
 * Muzzle flash sprite at gun barrel tip.
 */
export function muzzleFlash(scene, x, y) {
  const flash = scene.add
    .image(x, y, "muzzle_flash")
    .setScale(0.7)
    .setAlpha(0.9)
    .setDepth(8);

  scene.tweens.add({
    targets: flash,
    alpha: 0,
    scaleX: 1.4,
    scaleY: 1.4,
    duration: 80,
    onComplete: () => flash.destroy(),
  });
}

/**
 * Floating damage number that drifts up and fades out.
 */
export function damageNumber(scene, x, y, amount, isPositive = false) {
  const color = isPositive ? "#00ff66" : "#ff4444";
  const prefix = isPositive ? "+" : "-";
  const text = scene.add
    .text(x + Phaser.Math.Between(-8, 8), y - 10, `${prefix}${Math.abs(amount)}`, {
      fontSize: "14px",
      color,
      fontStyle: "bold",
      stroke: "#000000",
      strokeThickness: 2,
    })
    .setOrigin(0.5)
    .setDepth(20);

  scene.tweens.add({
    targets: text,
    y: y - 50,
    alpha: 0,
    duration: 800,
    ease: "Power2",
    onComplete: () => text.destroy(),
  });
}

/**
 * Pulsing "thinking" dot above a bot's head.
 * Returns the dot so it can be cleaned up.
 */
export function createThinkingDot(scene, container, offsetY = -42) {
  const dot = scene.add.circle(0, offsetY, 3, 0x00ff00);
  container.add(dot);

  scene.tweens.add({
    targets: dot,
    alpha: 0.2,
    duration: 600,
    yoyo: true,
    repeat: -1,
    ease: "Sine.easeInOut",
  });

  return dot;
}

/**
 * Slide overlay elements in from above with Back easing.
 */
export function slideInOverlay(scene, elements, duration = 400) {
  elements.forEach((el, i) => {
    const targetY = el.y;
    el.y = targetY - 120;
    el.setAlpha(0);
    scene.tweens.add({
      targets: el,
      y: targetY,
      alpha: 1,
      duration,
      delay: i * 80,
      ease: "Back.easeOut",
    });
  });
}

/**
 * Fade in UI elements with staggered delays.
 */
export function fadeInUI(scene, elements, baseDelay = 0, stagger = 80) {
  elements.forEach((el, i) => {
    el.setAlpha(0);
    scene.tweens.add({
      targets: el,
      alpha: 1,
      duration: 250,
      delay: baseDelay + i * stagger,
      ease: "Power2",
    });
  });
}

/**
 * Smoothly lerp a health bar's scaleX toward a target percentage.
 * Call each frame. Returns the new display value.
 */
export function lerpHealthBar(hpBar, displayPct, targetPct, speed = 0.1) {
  const newPct = displayPct + (targetPct - displayPct) * speed;
  hpBar.setScale(Math.max(0, newPct), 1);

  const r = Math.floor(255 * (1 - newPct));
  const g = Math.floor(255 * newPct);
  hpBar.setFillStyle(Phaser.Display.Color.GetColor(r, g, 0));

  return newPct;
}
