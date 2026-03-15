import * as tf from "@tensorflow/tfjs";

const INPUT_SIZE = 10;
const HIDDEN_SIZE = 16;
const OUTPUT_SIZE = 5;

export default class BotBrain {
  /**
   * @param {Array|null} existingWeights — serialized weights from getWeights(), or null for random init
   */
  constructor(existingWeights = null) {
    this.model = this.buildModel();

    if (existingWeights) {
      this.setWeights(existingWeights);
    }
  }

  buildModel() {
    const model = tf.sequential();

    model.add(
      tf.layers.dense({
        inputShape: [INPUT_SIZE],
        units: HIDDEN_SIZE,
        activation: "relu",
      })
    );

    model.add(
      tf.layers.dense({
        units: HIDDEN_SIZE,
        activation: "relu",
      })
    );

    model.add(
      tf.layers.dense({
        units: OUTPUT_SIZE,
        activation: "tanh",
      })
    );

    return model;
  }

  /**
   * Run a forward pass.
   * @param {number[]} inputArray — 10 floats, each normalized to 0-1
   * @returns {number[]} — 5 outputs in [-1, 1] (tanh): [moveX, moveY, rotate, shoot, strafe]
   */
  predict(inputArray) {
    return tf.tidy(() => {
      const input = tf.tensor2d([inputArray], [1, INPUT_SIZE]);
      const output = this.model.predict(input);
      return Array.from(output.dataSync());
    });
  }

  /**
   * Serialize all model weights to a plain JSON-safe array of layers,
   * where each layer is an array of typed-array-like number arrays.
   * @returns {Array} — nested arrays of numbers
   */
  getWeights() {
    return this.model.getWeights().map((t) => ({
      shape: t.shape,
      data: Array.from(t.dataSync()),
    }));
  }

  /**
   * Load weights from the format returned by getWeights().
   * @param {Array} weightsJson
   */
  setWeights(weightsJson) {
    const tensors = weightsJson.map((w) => tf.tensor(w.data, w.shape));
    this.model.setWeights(tensors);
    tensors.forEach((t) => t.dispose());
  }

  /**
   * Create a new BotBrain with identical weights.
   * @returns {BotBrain}
   */
  clone() {
    return new BotBrain(this.getWeights());
  }

  /**
   * Randomly perturb weights in-place for genetic evolution.
   * @param {number} mutationRate  — probability each weight is mutated (0-1)
   * @param {number} mutationStrength — std-dev of gaussian noise added
   */
  mutate(mutationRate = 0.1, mutationStrength = 0.3) {
    const weights = this.model.getWeights();
    const mutated = weights.map((t) => {
      return tf.tidy(() => {
        const data = t.dataSync().slice(); // copy
        for (let i = 0; i < data.length; i++) {
          if (Math.random() < mutationRate) {
            data[i] += gaussianRandom() * mutationStrength;
          }
        }
        return tf.tensor(data, t.shape);
      });
    });

    this.model.setWeights(mutated);
    mutated.forEach((t) => t.dispose());
  }

  /**
   * Free GPU/CPU memory held by the model.
   */
  dispose() {
    this.model.dispose();
  }
}

/**
 * Box-Muller transform for gaussian random numbers.
 */
function gaussianRandom() {
  let u = 0;
  let v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}
