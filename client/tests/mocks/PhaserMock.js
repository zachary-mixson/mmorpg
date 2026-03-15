import { vi } from "vitest";

// ── Shared stubs ──────────────────────────────────────────

function noop() {}
function chainable() {
  return new Proxy(
    {},
    {
      get(target, prop) {
        if (prop === "then" || prop === Symbol.toPrimitive) return undefined;
        return (..._args) => chainable();
      },
    }
  );
}

// ── Game Objects ──────────────────────────────────────────

class MockSprite {
  constructor(scene, x, y, texture) {
    this.scene = scene;
    this.x = x || 0;
    this.y = y || 0;
    this.texture = texture;
    this.active = true;
    this.visible = true;
    this.alpha = 1;
    this.rotation = 0;
    this.scaleX = 1;
    this.scaleY = 1;
    this.depth = 0;
    this.body = new MockBody();
  }
  setPosition(x, y) { this.x = x; this.y = y; return this; }
  setScale(x, y) { this.scaleX = x; this.scaleY = y ?? x; return this; }
  setAlpha(a) { this.alpha = a; return this; }
  setDepth(d) { this.depth = d; return this; }
  setActive(v) { this.active = v; return this; }
  setVisible(v) { this.visible = v; return this; }
  setOrigin() { return this; }
  setScrollFactor() { return this; }
  setRotation(r) { this.rotation = r; return this; }
  setTint() { return this; }
  setFillStyle() { return this; }
  setInteractive() { return this; }
  setVelocity(vx, vy) { if (this.body) { this.body.velocity.x = vx; this.body.velocity.y = vy; } return this; }
  on() { return this; }
  destroy() { this.active = false; }
}

class MockContainer extends MockSprite {
  constructor(scene, x, y) {
    super(scene, x, y);
    this.list = [];
  }
  add(child) { this.list.push(child); return this; }
  remove(child) { this.list = this.list.filter((c) => c !== child); return this; }
}

class MockBody {
  constructor() {
    this.velocity = { x: 0, y: 0 };
    this.enable = true;
  }
  setVelocity(x, y) { this.velocity.x = x; this.velocity.y = y; }
  setSize() {}
  setCollideWorldBounds() {}
}

class MockGraphics {
  fillStyle() { return this; }
  fillRect() { return this; }
  fillCircle() { return this; }
  lineStyle() { return this; }
  strokeRect() { return this; }
  lineBetween() { return this; }
  generateTexture() { return this; }
  setDepth() { return this; }
  destroy() {}
  clear() { return this; }
}

// ── Particle Emitter ──────────────────────────────────────

class MockParticleEmitter {
  constructor() {
    this.depth = 0;
  }
  setDepth(d) { this.depth = d; return this; }
  explode() { return this; }
  destroy() {}
  stop() {}
}

// ── Physics ───────────────────────────────────────────────

class MockPhysicsWorld {
  constructor() {
    this.bounds = { x: 0, y: 0, width: 800, height: 600 };
  }
  setBounds(x, y, w, h) {
    this.bounds = { x, y, width: w, height: h };
  }
  enable() {}
}

class MockPhysicsGroup {
  constructor() {
    this.children = { each: vi.fn() };
  }
  add() { return this; }
  getFirstDead() { return null; }
}

class MockArcadePhysics {
  constructor() {
    this.world = new MockPhysicsWorld();
  }
  add = {
    group: () => new MockPhysicsGroup(),
    staticGroup: () => new MockPhysicsGroup(),
    overlap: vi.fn(),
    collider: vi.fn(),
    existing: vi.fn(),
  };
}

// ── Scene ─────────────────────────────────────────────────

class MockScene {
  constructor(config) {
    this.key = typeof config === "string" ? config : config?.key;
    this.physics = new MockArcadePhysics();
    this.input = {
      keyboard: { addKeys: () => ({}) },
      mouse: { disableContextMenu: noop },
      on: noop,
      activePointer: { x: 0, y: 0, isDown: false, leftButtonDown: () => false },
    };
    this.cameras = {
      main: {
        setBounds: noop,
        startFollow: noop,
        getWorldPoint: (x, y) => ({ x, y }),
        shake: vi.fn(),
        scrollX: 0,
        scrollY: 0,
      },
    };
    this.time = {
      addEvent: () => ({ destroy: noop }),
      delayedCall: vi.fn((delay, cb) => { cb(); return { destroy: noop }; }),
      now: 0,
    };
    this.tweens = {
      add: vi.fn((config) => {
        if (config.onComplete) config.onComplete();
        return { destroy: noop };
      }),
    };
    this.textures = {
      exists: () => false,
    };
    this.scene = {
      start: vi.fn(),
      restart: vi.fn(),
    };
    this.events = { on: noop, off: noop, emit: noop };
  }

  add = {
    existing: vi.fn(),
    rectangle: (...args) => new MockSprite(this, args[0], args[1]),
    circle: (...args) => new MockSprite(this, args[0], args[1]),
    text: (...args) => new MockSprite(this, args[0], args[1]),
    image: (...args) => new MockSprite(this, args[0], args[1]),
    tileSprite: (...args) => new MockSprite(this, args[0], args[1]),
    graphics: () => new MockGraphics(),
    container: (x, y) => new MockContainer(this, x, y),
    group: () => ({ add: noop, clear: noop, children: [] }),
    particles: () => new MockParticleEmitter(),
  };

  make = {
    graphics: () => new MockGraphics(),
  };
}

// ── Phaser namespace mock ──────────────────────────────────

const Phaser = {
  Scene: MockScene,
  AUTO: 0,
  GameObjects: {
    Sprite: MockSprite,
    Container: MockContainer,
    Graphics: MockGraphics,
  },
  Physics: {
    Arcade: {
      Sprite: MockSprite,
      Group: MockPhysicsGroup,
      World: MockPhysicsWorld,
    },
  },
  Math: {
    Between: (min, max) => Math.floor(Math.random() * (max - min + 1)) + min,
    Angle: {
      Between: (x1, y1, x2, y2) => Math.atan2(y2 - y1, x2 - x1),
      Wrap: (angle) => {
        while (angle > Math.PI) angle -= 2 * Math.PI;
        while (angle < -Math.PI) angle += 2 * Math.PI;
        return angle;
      },
      RotateTo: (current, target, speed) => {
        const diff = Phaser.Math.Angle.Wrap(target - current);
        return current + diff * speed;
      },
    },
    Distance: {
      Between: (x1, y1, x2, y2) =>
        Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2),
    },
    DegToRad: (deg) => (deg * Math.PI) / 180,
    RadToDeg: (rad) => (rad * 180) / Math.PI,
    Clamp: (val, min, max) => Math.min(Math.max(val, min), max),
  },
  Display: {
    Color: {
      GetColor: (r, g, b) => (r << 16) | (g << 8) | (b || 0),
    },
  },
  Input: {
    Keyboard: {
      KeyCodes: {
        W: 87, A: 65, S: 83, D: 68,
        SHIFT: 16, Q: 81,
        UP: 38, DOWN: 40, LEFT: 37, RIGHT: 39,
      },
      JustDown: () => false,
    },
  },
  Game: vi.fn(),
};

export default Phaser;
export {
  MockScene,
  MockSprite,
  MockContainer,
  MockGraphics,
  MockParticleEmitter,
  MockBody,
  MockPhysicsGroup,
  MockArcadePhysics,
};
