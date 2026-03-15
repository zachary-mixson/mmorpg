import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import authRoutes from "../src/routes/auth.js";
import aiRoutes from "../src/routes/ai.js";
import shopRoutes from "../src/routes/shop.js";
import gameRoutes from "../src/routes/game.js";

/**
 * Creates a fresh Express app + HTTP server for testing.
 * Does NOT call listen() — supertest handles that.
 * Does NOT set up game rooms / matchmaking (those need socket tests).
 */
export function createTestApp() {
  const app = express();
  const httpServer = createServer(app);
  const io = new Server(httpServer, { cors: { origin: "*" } });

  app.use(express.json());

  app.get("/", (_req, res) => {
    res.json({ status: "ok" });
  });

  app.use("/auth", authRoutes);
  app.use("/ai", aiRoutes);
  app.use("/shop", shopRoutes);
  app.use("/game", gameRoutes);

  return { app, httpServer, io };
}
