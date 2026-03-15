import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    include: ["tests/**/*.test.js"],
    coverage: {
      provider: "v8",
      include: ["src/**/*.js"],
      exclude: ["src/main.js"],
    },
    alias: {
      phaser: new URL("./tests/mocks/PhaserMock.js", import.meta.url).pathname,
      "@tensorflow/tfjs": new URL("./tests/mocks/TensorFlowMock.js", import.meta.url).pathname,
    },
  },
});
