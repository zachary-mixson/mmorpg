import { jest } from "@jest/globals";
import supertest from "supertest";
import { createTestApp } from "./app.js";

// Point at test database
process.env.PGDATABASE = "ai_shooter_test";
process.env.JWT_SECRET = "test-jwt-secret";

const { app } = createTestApp();
const request = supertest(app);

describe("Auth Routes", () => {
  describe("POST /auth/register", () => {
    it("should register a new user and return a token", async () => {
      const res = await request.post("/auth/register").send({
        username: "newuser_" + Date.now(),
        password: "securepass123",
      });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty("token");
      expect(typeof res.body.token).toBe("string");
    });

    it("should reject duplicate username", async () => {
      const res = await request.post("/auth/register").send({
        username: "testplayer1",
        password: "password123",
      });

      expect(res.status).toBe(409);
    });

    it("should reject missing fields", async () => {
      const res = await request.post("/auth/register").send({
        username: "nopass",
      });

      expect(res.status).toBe(400);
    });
  });

  describe("POST /auth/login", () => {
    it("should login with valid credentials", async () => {
      const res = await request.post("/auth/login").send({
        username: "testplayer1",
        password: "password123",
      });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("token");
    });

    it("should reject invalid password", async () => {
      const res = await request.post("/auth/login").send({
        username: "testplayer1",
        password: "wrongpassword",
      });

      expect(res.status).toBe(401);
    });

    it("should reject non-existent user", async () => {
      const res = await request.post("/auth/login").send({
        username: "nosuchuser",
        password: "password123",
      });

      expect(res.status).toBe(401);
    });
  });

  describe("GET /auth/me", () => {
    it("should return user info with valid token", async () => {
      const loginRes = await request.post("/auth/login").send({
        username: "testplayer1",
        password: "password123",
      });
      const token = loginRes.body.token;

      const res = await request
        .get("/auth/me")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.username).toBe("testplayer1");
      expect(res.body).toHaveProperty("currency");
    });

    it("should reject request without token", async () => {
      const res = await request.get("/auth/me");

      expect(res.status).toBe(401);
    });
  });
});
