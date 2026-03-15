import { jest } from "@jest/globals";
import supertest from "supertest";
import { createTestApp } from "./app.js";

process.env.PGDATABASE = "ai_shooter_test";
process.env.JWT_SECRET = "test-jwt-secret";

const { app } = createTestApp();
const request = supertest(app);

async function getToken(username = "testplayer2") {
  const res = await request.post("/auth/login").send({
    username,
    password: "password123",
  });
  return res.body.token;
}

describe("Shop Routes", () => {
  let token;

  beforeAll(async () => {
    token = await getToken();
  });

  describe("GET /shop/items", () => {
    it("should return list of upgrades", async () => {
      const res = await request
        .get("/shop/items")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("items");
      expect(Array.isArray(res.body.items)).toBe(true);
      expect(res.body.items.length).toBeGreaterThan(0);

      const item = res.body.items[0];
      expect(item).toHaveProperty("name");
      expect(item).toHaveProperty("price");
      expect(item).toHaveProperty("type");
      expect(item).toHaveProperty("purchased");
    });
  });

  describe("POST /shop/buy/:upgradeId", () => {
    it("should purchase an upgrade successfully", async () => {
      // Get items first to find a valid upgrade
      const itemsRes = await request
        .get("/shop/items")
        .set("Authorization", `Bearer ${token}`);

      const cheapest = itemsRes.body.items
        .filter((i) => !i.purchased)
        .sort((a, b) => a.price - b.price)[0];

      if (!cheapest) return; // Skip if all purchased

      const res = await request
        .post(`/shop/buy/${cheapest.id}`)
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("currency");
    });

    it("should reject buying non-existent upgrade", async () => {
      const res = await request
        .post("/shop/buy/99999")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(404);
    });
  });

  describe("GET /shop/mystats", () => {
    it("should return compiled player stats", async () => {
      const res = await request
        .get("/shop/mystats")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("stats");
      expect(res.body.stats).toHaveProperty("player");
      expect(res.body.stats).toHaveProperty("bot");
    });
  });
});
