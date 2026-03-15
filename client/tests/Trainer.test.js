import { describe, it, expect, beforeEach, vi } from "vitest";

// Mock localStorage
const storage = {};
const localStorageMock = {
  getItem: vi.fn((key) => storage[key] ?? null),
  setItem: vi.fn((key, value) => { storage[key] = value; }),
  removeItem: vi.fn((key) => { delete storage[key]; }),
  clear: vi.fn(() => { for (const k in storage) delete storage[k]; }),
};
global.localStorage = localStorageMock;

// Mock fetch
global.fetch = vi.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve({}) }));

import Trainer from "../src/ai/Trainer.js";
import BotBrain from "../src/ai/BotBrain.js";

describe("Trainer", () => {
  beforeEach(() => {
    localStorageMock.clear();
    vi.clearAllMocks();
  });

  it("should initialize with empty state", () => {
    const trainer = new Trainer();
    expect(trainer.generation).toBe(0);
    expect(trainer.bestFitness).toBe(-Infinity);
  });

  it("should load persisted state from localStorage", () => {
    const state = {
      generation: 5,
      bestFitness: 42,
      population: [{ weights: [], fitness: 42 }],
    };
    storage.ai_trainer_state = JSON.stringify(state);

    const trainer = new Trainer();
    expect(trainer.generation).toBe(5);
    expect(trainer.bestFitness).toBe(42);
  });

  it("should handle corrupted localStorage gracefully", () => {
    storage.ai_trainer_state = "not valid json{{{";

    const trainer = new Trainer();
    expect(trainer.generation).toBe(0);
  });

  it("should save state to localStorage", () => {
    const trainer = new Trainer();
    trainer.save();
    expect(localStorageMock.setItem).toHaveBeenCalledWith(
      "ai_trainer_state",
      expect.any(String)
    );
  });

  it("should return null from getNextWeights with insufficient population", () => {
    const trainer = new Trainer();
    expect(trainer.getNextWeights()).toBeNull();
  });

  it("should reset state", () => {
    const trainer = new Trainer();
    trainer.state.generation = 10;
    trainer.state.bestFitness = 100;
    trainer.reset();

    expect(trainer.generation).toBe(0);
    expect(trainer.bestFitness).toBe(-Infinity);
  });

  it("should submit results and update population", async () => {
    const trainer = new Trainer();
    const brain = new BotBrain();

    await trainer.submitResult(25.0, brain);

    expect(trainer.generation).toBe(1);
    expect(trainer.bestFitness).toBe(25.0);
    expect(trainer.state.population.length).toBe(1);
  });

  it("should crossover two weight arrays", () => {
    const trainer = new Trainer();
    const parentA = [
      { shape: [2, 3], data: [1, 2, 3, 4, 5, 6] },
    ];
    const parentB = [
      { shape: [2, 3], data: [7, 8, 9, 10, 11, 12] },
    ];

    const child = trainer.crossover(parentA, parentB);

    expect(child.length).toBe(1);
    expect(child[0].data.length).toBe(6);
    expect(child[0].shape).toEqual([2, 3]);

    // Each value should come from either parent
    for (let i = 0; i < 6; i++) {
      expect([parentA[0].data[i], parentB[0].data[i]]).toContain(child[0].data[i]);
    }
  });
});
