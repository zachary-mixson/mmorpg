import { vi } from "vitest";

// ── Tensor Mock ───────────────────────────────────────────

class MockTensor {
  constructor(data, shape) {
    this._data = Array.isArray(data) ? Float32Array.from(data.flat(Infinity)) : data;
    this.shape = shape || [this._data.length];
    this.dtype = "float32";
    this.isDisposed = false;
  }

  async data() {
    return this._data;
  }

  dataSync() {
    return this._data;
  }

  arraySync() {
    if (this.shape.length === 1) return Array.from(this._data);
    // Simple 2D reshape
    const [rows, cols] = this.shape;
    const result = [];
    for (let r = 0; r < rows; r++) {
      result.push(Array.from(this._data.slice(r * cols, (r + 1) * cols)));
    }
    return result;
  }

  dispose() {
    this.isDisposed = true;
  }

  reshape(shape) {
    return new MockTensor(this._data, shape);
  }
}

// ── Layer Mock ────────────────────────────────────────────

class MockLayer {
  constructor(config) {
    this.config = config;
    this.units = config?.units || 1;
    this.inputShape = config?.inputShape;
    this._weights = [];
  }

  getWeights() {
    if (this._weights.length > 0) return this._weights;

    const inputDim = this.inputShape ? this.inputShape[0] : 16;
    const kernel = new MockTensor(
      new Float32Array(inputDim * this.units).fill(0.1),
      [inputDim, this.units]
    );
    const bias = new MockTensor(
      new Float32Array(this.units).fill(0),
      [this.units]
    );
    return [kernel, bias];
  }

  setWeights(weights) {
    this._weights = weights;
  }

  apply(input) {
    return new MockTensor(new Float32Array(this.units).fill(0.5), [1, this.units]);
  }
}

// ── Model Mock ────────────────────────────────────────────

class MockModel {
  constructor() {
    this.layers = [];
    this._compiled = false;
  }

  add(layer) {
    // Set inputShape for subsequent layers based on previous layer's units
    if (this.layers.length > 0 && !layer.inputShape) {
      layer.inputShape = [this.layers[this.layers.length - 1].units];
    }
    this.layers.push(layer);
  }

  compile() {
    this._compiled = true;
  }

  predict(inputTensor) {
    const lastLayer = this.layers[this.layers.length - 1];
    const outputSize = lastLayer ? lastLayer.units : 1;
    return new MockTensor(
      new Float32Array(outputSize).fill(0.5),
      [1, outputSize]
    );
  }

  getWeights() {
    const weights = [];
    for (const layer of this.layers) {
      weights.push(...layer.getWeights());
    }
    return weights;
  }

  setWeights(weights) {
    let idx = 0;
    for (const layer of this.layers) {
      const layerWeights = layer.getWeights();
      const count = layerWeights.length;
      layer.setWeights(weights.slice(idx, idx + count));
      idx += count;
    }
  }

  dispose() {
    this.layers = [];
  }
}

// ── TensorFlow namespace mock ─────────────────────────────

const tf = {
  sequential: () => new MockModel(),

  layers: {
    dense: (config) => new MockLayer(config),
  },

  tensor2d: (data, shape) => {
    const flat = Array.isArray(data) ? data.flat(Infinity) : [data];
    return new MockTensor(Float32Array.from(flat), shape || [1, flat.length]);
  },

  tensor: (data, shape) => {
    const flat = Array.isArray(data) ? data.flat(Infinity) : [data];
    return new MockTensor(Float32Array.from(flat), shape);
  },

  tidy: (fn) => fn(),

  dispose: (tensors) => {
    if (Array.isArray(tensors)) {
      tensors.forEach((t) => t && t.dispose && t.dispose());
    } else if (tensors && tensors.dispose) {
      tensors.dispose();
    }
  },

  randomNormal: (shape) => {
    const size = shape.reduce((a, b) => a * b, 1);
    const data = new Float32Array(size);
    for (let i = 0; i < size; i++) {
      data[i] = (Math.random() - 0.5) * 2;
    }
    return new MockTensor(data, shape);
  },

  zeros: (shape) => {
    const size = shape.reduce((a, b) => a * b, 1);
    return new MockTensor(new Float32Array(size), shape);
  },

  ones: (shape) => {
    const size = shape.reduce((a, b) => a * b, 1);
    return new MockTensor(new Float32Array(size).fill(1), shape);
  },

  ready: () => Promise.resolve(),
  getBackend: () => "cpu",
  setBackend: vi.fn(() => Promise.resolve()),
  engine: () => ({
    startScope: noop,
    endScope: noop,
  }),

  // Memory management
  memory: () => ({ numTensors: 0, numBytes: 0 }),
};

function noop() {}

// Named exports — required because BotBrain uses `import * as tf`
export const sequential = tf.sequential;
export const layers = tf.layers;
export const tensor2d = tf.tensor2d;
export const tensor = tf.tensor;
export const tidy = tf.tidy;
export const dispose = tf.dispose;
export const randomNormal = tf.randomNormal;
export const zeros = tf.zeros;
export const ones = tf.ones;
export const ready = tf.ready;
export const getBackend = tf.getBackend;
export const setBackend = tf.setBackend;
export const engine = tf.engine;
export const memory = tf.memory;

export default tf;
export { MockTensor, MockModel, MockLayer };
