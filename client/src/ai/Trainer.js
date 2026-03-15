import BotBrain from "./BotBrain.js";

const API_URL = "http://localhost:3000";
const POPULATION_SIZE = 8;
const ELITE_COUNT = 4;
const STORAGE_KEY = "ai_trainer_state";
const MUTATION_RATE = 0.1;
const MUTATION_STRENGTH = 0.05;

export default class Trainer {
  constructor() {
    this.state = this.load();
  }

  /**
   * Load persisted state from localStorage.
   * @returns {{ generation: number, bestFitness: number, population: Array<{ weights: Array, fitness: number }> }}
   */
  load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed.population && Array.isArray(parsed.population)) {
          return parsed;
        }
      }
    } catch {
      // Corrupted data — start fresh
    }
    return { generation: 0, bestFitness: -Infinity, population: [] };
  }

  /**
   * Persist state to localStorage.
   */
  save() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
  }

  get generation() {
    return this.state.generation;
  }

  get bestFitness() {
    return this.state.bestFitness;
  }

  /**
   * Get the weights to use for the next training match.
   * If population exists, produce offspring from top performers.
   * Otherwise return null (BotBrain will use random init or server weights).
   */
  getNextWeights() {
    if (this.state.population.length < 2) {
      return null;
    }

    // Sort descending by fitness
    this.state.population.sort((a, b) => b.fitness - a.fitness);

    // Crossover top 2 parents → child, then mutate
    const parentA = this.state.population[0].weights;
    const parentB = this.state.population[1].weights;
    const childWeights = this.crossover(parentA, parentB);

    // Apply mutation via a temporary BotBrain
    const child = new BotBrain(childWeights);
    child.mutate(MUTATION_RATE, MUTATION_STRENGTH);
    const mutatedWeights = child.getWeights();
    child.dispose();

    return mutatedWeights;
  }

  /**
   * Crossover two parent weight sets by randomly picking each weight
   * value from one parent or the other.
   */
  crossover(parentA, parentB) {
    return parentA.map((layerA, i) => {
      const layerB = parentB[i];
      const data = new Array(layerA.data.length);
      for (let j = 0; j < data.length; j++) {
        data[j] = Math.random() < 0.5 ? layerA.data[j] : layerB.data[j];
      }
      return { shape: layerA.shape.slice(), data };
    });
  }

  /**
   * Submit training results after a match.
   * Updates population, increments generation, saves best to server.
   *
   * @param {number} fitness — the fitness score from the match
   * @param {import('./BotBrain.js').default} brain — the BotBrain used in the match
   * @returns {Promise<void>}
   */
  async submitResult(fitness, brain) {
    const weights = brain.getWeights();

    // Update best fitness
    if (fitness > this.state.bestFitness) {
      this.state.bestFitness = fitness;
    }

    // Add to population
    this.state.population.push({ weights, fitness });

    // Sort descending by fitness
    this.state.population.sort((a, b) => b.fitness - a.fitness);

    // If the new entry is in the top ELITE_COUNT, keep it; trim to POPULATION_SIZE
    if (this.state.population.length > POPULATION_SIZE) {
      this.state.population = this.state.population.slice(0, POPULATION_SIZE);
    }

    this.state.generation++;
    this.save();

    // Save best weights to server
    await this.saveBestToServer();
  }

  /**
   * POST the top performer's weights to the server.
   */
  async saveBestToServer() {
    if (this.state.population.length === 0) return;

    const best = this.state.population[0];
    try {
      const token = localStorage.getItem("token");
      await fetch(`${API_URL}/ai/weights`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ weights: best.weights }),
      });
    } catch {
      // Network error — weights still saved locally
    }
  }

  /**
   * Reset all evolutionary state.
   */
  reset() {
    this.state = { generation: 0, bestFitness: -Infinity, population: [] };
    this.save();
  }
}
