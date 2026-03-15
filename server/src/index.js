import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import cors from "cors";
import authRoutes from "./routes/auth.js";
import aiRoutes from "./routes/ai.js";
import shopRoutes from "./routes/shop.js";
import gameRoutes from "./routes/game.js";
import setupGameRooms from "../game/GameRoom.js";
import { getQueueStatus } from "../game/Matchmaker.js";

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: "http://localhost:5173",
    methods: ["GET", "POST"],
  },
});

app.use(cors({ origin: "http://localhost:5173" }));
app.use(express.json());

app.get("/", (_req, res) => {
  res.json({ status: "ok" });
});

app.use("/auth", authRoutes);
app.use("/ai", aiRoutes);
app.use("/shop", shopRoutes);
app.use("/game", gameRoutes);

app.get("/matchmaking/status", (_req, res) => {
  res.json(getQueueStatus());
});

// Set up multiplayer game rooms + matchmaking on /game namespace
setupGameRooms(io);

io.on("connection", (socket) => {
  console.log(`Player connected: ${socket.id}`);

  socket.on("disconnect", () => {
    console.log(`Player disconnected: ${socket.id}`);
  });
});

const PORT = 3000;
httpServer.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
