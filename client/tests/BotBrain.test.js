import { describe, it, expect } from "vitest";
import BotBrain from "../src/ai/BotBrain.js";

describe("BotBrain", () => {
  it("should construct without existing weights", () => {
    const brain = new BotBrain();
    expect(brain.model).toBeDefined();
  });

  it("should produce 5 outputs from predict()", () => {
    const brain = new BotBrain();
    const input = new Array(10).fill(0.5);
    const output = brain.predict(input);

    expect(Array.isArray(output)).toBe(true);
    expect(output.length).toBe(5);
  });

  it("should serialize and deserialize weights via getWeights/setWeights", () => {
    const brain = new BotBrain();
    const weights = brain.getWeights();

    expect(Array.isArray(weights)).toBe(true);
    expect(weights.length).toBeGreaterThan(0);

    // Each layer should have shape and data
    for (const layer of weights) {
      expect(layer).toHaveProperty("shape");
      expect(layer).toHaveProperty("data");
      expect(Array.isArray(layer.shape)).toBe(true);
      expect(Array.isArray(layer.data)).toBe(true);
    }

    // Should be able to create a new brain from these weights
    const brain2 = new BotBrain(weights);
    expect(brain2.model).toBeDefined();
  });

  it("should clone and produce a valid brain", () => {
    const brain = new BotBrain();
    const clone = brain.clone();

    expect(clone).toBeInstanceOf(BotBrain);
    expect(clone.model).toBeDefined();

    const output = clone.predict(new Array(10).fill(0.3));
    expect(output.length).toBe(5);
  });

  it("should mutate without errors", () => {
    const brain = new BotBrain();
    expect(() => brain.mutate(0.5, 0.1)).not.toThrow();
  });

  it("should dispose without errors", () => {
    const brain = new BotBrain();
    expect(() => brain.dispose()).not.toThrow();
  });
});
