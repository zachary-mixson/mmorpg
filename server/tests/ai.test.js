import { jest } from "@jest/globals";
import supertest from "supertest";
import { createTestApp } from "./app.js";

process.env.PGDATABASE = "ai_shooter_test";
process.env.JWT_SECRET = "test-jwt-secret";

const { app } = createTestApp();
const request = supertest(app);

/** Helper: login as testplayer1 and return the token */
async function getToken(username = "testplayer1") {
  const res = await request.post("/auth/login").send({
    username,
    password: "password123",
  });
  return res.body.token;
}

describe("AI Weights Routes", () => {
  let token;

  beforeAll(async () => {
    token = await getToken();
  });

  describe("GET /ai/weights", () => {
    it("should return the latest weights for the player", async () => {
      const res = await request
        .get("/ai/weights")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("weights");
      expect(res.body).toHaveProperty("version");
      expect(res.body).toHaveProperty("fitness");
    });

    it("should reject unauthenticated requests", async () => {
      const res = await request.get("/ai/weights");
      expect(res.status).toBe(401);
    });
  });

  describe("POST /ai/weights", () => {
    it("should save new weights as a new version", async () => {
      const weights = [
        { shape: [10, 16], data: new Array(160).fill(0.5) },
      ];

      const res = await request
        .post("/ai/weights")
        .set("Authorization", `Bearer ${token}`)
        .send({ weights, fitness: 25.0 });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty("version");
      expect(res.body).toHaveProperty("fitness");
      expect(res.body.fitness).toBe(25.0);
    });

    it("should reject request without weights", async () => {
      const res = await request
        .post("/ai/weights")
        .set("Authorization", `Bearer ${token}`)
        .send({ fitness: 10 });

      expect(res.status).toBe(400);
    });
  });

  describe("GET /ai/weights/history", () => {
    it("should return version history", async () => {
      const res = await request
        .get("/ai/weights/history")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("versions");
      expect(Array.isArray(res.body.versions)).toBe(true);
      expect(res.body.versions.length).toBeGreaterThanOrEqual(1);

      // Should be ordered by version descending
      const versions = res.body.versions.map((v) => v.version);
      for (let i = 1; i < versions.length; i++) {
        expect(versions[i - 1]).toBeGreaterThan(versions[i]);
      }
    });
  });

  describe("POST /ai/weights/rollback/:version", () => {
    it("should rollback to a previous version", async () => {
      const res = await request
        .post("/ai/weights/rollback/1")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty("rolledBackFrom", 1);
      expect(res.body).toHaveProperty("version");
    });

    it("should reject rollback to non-existent version", async () => {
      const res = await request
        .post("/ai/weights/rollback/999")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(404);
    });

    it("should reject invalid version number", async () => {
      const res = await request
        .post("/ai/weights/rollback/abc")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(400);
    });
  });
});
