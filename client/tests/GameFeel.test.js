import { describe, it, expect, vi } from "vitest";
import {
  generateFXTextures,
  screenShake,
  bulletImpact,
  deathExplosion,
  muzzleFlash,
  damageNumber,
  createThinkingDot,
  slideInOverlay,
  fadeInUI,
  lerpHealthBar,
} from "../src/utils/GameFeel.js";
import { MockScene, MockSprite, MockContainer } from "./mocks/PhaserMock.js";

function createMockScene() {
  return new MockScene("TestScene");
}

describe("GameFeel utilities", () => {
  describe("generateFXTextures", () => {
    it("should call make.graphics to create textures", () => {
      const scene = createMockScene();
      expect(() => generateFXTextures(scene)).not.toThrow();
    });
  });

  describe("screenShake", () => {
    it("should call camera.shake with correct params", () => {
      const camera = { shake: vi.fn() };
      screenShake(camera, 0.004, 80);
      expect(camera.shake).toHaveBeenCalledWith(80, 0.004);
    });

    it("should use default values", () => {
      const camera = { shake: vi.fn() };
      screenShake(camera);
      expect(camera.shake).toHaveBeenCalled();
    });
  });

  describe("bulletImpact", () => {
    it("should create particles without throwing", () => {
      const scene = createMockScene();
      expect(() => bulletImpact(scene, 100, 200)).not.toThrow();
    });
  });

  describe("deathExplosion", () => {
    it("should create explosion particles without throwing", () => {
      const scene = createMockScene();
      expect(() => deathExplosion(scene, 100, 200, 0xff0000)).not.toThrow();
    });
  });

  describe("muzzleFlash", () => {
    it("should create a flash image and tween it", () => {
      const scene = createMockScene();
      expect(() => muzzleFlash(scene, 100, 200)).not.toThrow();
      expect(scene.tweens.add).toHaveBeenCalled();
    });
  });

  describe("damageNumber", () => {
    it("should create floating text for damage", () => {
      const scene = createMockScene();
      expect(() => damageNumber(scene, 100, 200, 25)).not.toThrow();
      expect(scene.tweens.add).toHaveBeenCalled();
    });

    it("should create positive (heal) damage number", () => {
      const scene = createMockScene();
      expect(() => damageNumber(scene, 100, 200, 10, true)).not.toThrow();
    });
  });

  describe("createThinkingDot", () => {
    it("should add a pulsing dot to the container", () => {
      const scene = createMockScene();
      const container = new MockContainer(scene, 0, 0);
      const dot = createThinkingDot(scene, container);

      expect(dot).toBeDefined();
      expect(container.list).toContain(dot);
      expect(scene.tweens.add).toHaveBeenCalled();
    });
  });

  describe("slideInOverlay", () => {
    it("should set up tweens for each element", () => {
      const scene = createMockScene();
      const el1 = new MockSprite(scene, 0, 100);
      const el2 = new MockSprite(scene, 0, 200);

      slideInOverlay(scene, [el1, el2]);

      // Should have been called for each element
      expect(scene.tweens.add).toHaveBeenCalled();
    });
  });

  describe("fadeInUI", () => {
    it("should set alpha to 0 and tween to 1", () => {
      const scene = createMockScene();
      const el1 = new MockSprite(scene, 0, 0);
      const el2 = new MockSprite(scene, 0, 0);

      fadeInUI(scene, [el1, el2], 0, 100);

      expect(scene.tweens.add).toHaveBeenCalled();
    });
  });

  describe("lerpHealthBar", () => {
    it("should lerp toward target percentage", () => {
      const hpBar = {
        setScale: vi.fn(),
        setFillStyle: vi.fn(),
      };

      const result = lerpHealthBar(hpBar, 1.0, 0.5, 0.1);

      // Should move 10% of the way from 1.0 toward 0.5
      expect(result).toBeCloseTo(0.95, 2);
      expect(hpBar.setScale).toHaveBeenCalled();
      expect(hpBar.setFillStyle).toHaveBeenCalled();
    });

    it("should converge over multiple calls", () => {
      const hpBar = {
        setScale: vi.fn(),
        setFillStyle: vi.fn(),
      };

      let pct = 1.0;
      for (let i = 0; i < 50; i++) {
        pct = lerpHealthBar(hpBar, pct, 0.5, 0.1);
      }

      expect(pct).toBeCloseTo(0.5, 1);
    });
  });
});
