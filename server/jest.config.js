export default {
  testEnvironment: "node",
  transform: {},
  testMatch: ["<rootDir>/tests/**/*.test.js"],
  globalSetup: "<rootDir>/tests/setup.js",
  globalTeardown: "<rootDir>/tests/teardown.js",
};
