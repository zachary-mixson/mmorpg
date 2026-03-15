import {
  createRoom,
  initPlayerState,
  initBotState,
  startRoom,
  rooms,
  ARENA_W,
  ARENA_H,
  MATCH_DURATION,
  endMatch,
} from "./GameRoom.js";

const QUEUE_TIMEOUT = 10_000; // 10 seconds

// Ordered queue of waiting players
const queue = [];
// socketId → timeout handle
const timeouts = new Map();

/**
 * Add a player to the matchmaking queue.
 * If a second player is already waiting, create a room immediately.
 */
function enqueue(socket, gameNsp) {
  // Already in a room?
  if (socket.roomId) {
    socket.emit("error", { message: "Already in a match" });
    return;
  }

  // Already in queue?
  if (queue.find((s) => s.id === socket.id)) {
    socket.emit("error", { message: "Already in queue" });
    return;
  }

  queue.push(socket);

  // Try to match immediately
  if (tryMatch(gameNsp)) return;

  // No opponent yet — start timeout
  const position = queue.indexOf(socket);
  socket.emit("waiting", {
    message: "Waiting for opponent...",
    position: position + 1,
    queueSize: queue.length,
  });

  const handle = setTimeout(() => {
    removeFromQueue(socket);
    socket.emit("queueTimeout", {
      message: "No opponent found. Search cancelled.",
    });
  }, QUEUE_TIMEOUT);

  timeouts.set(socket.id, handle);
}

/**
 * Try to pair the first two connected players in the queue.
 * Returns true if a match was made.
 */
function tryMatch(gameNsp) {
  // Purge disconnected sockets
  for (let i = queue.length - 1; i >= 0; i--) {
    if (!queue[i].connected) {
      clearPlayerTimeout(queue[i].id);
      queue.splice(i, 1);
    }
  }

  if (queue.length < 2) return false;

  const p1 = queue.shift();
  const p2 = queue.shift();
  clearPlayerTimeout(p1.id);
  clearPlayerTimeout(p2.id);

  createMatch(p1, p2, gameNsp);
  return true;
}

/**
 * Create a match between two players.
 */
function createMatch(p1, p2, gameNsp) {
  const room = createRoom();

  // Spawn positions
  const spawnX1 = ARENA_W / 2 - 200;
  const spawnX2 = ARENA_W / 2 + 200;
  const spawnY = ARENA_H / 2;

  // Init player states
  initPlayerState(room, p1.id, p1.user.id, p1.user.username, p1.stats, spawnX1, spawnY);
  initPlayerState(room, p2.id, p2.user.id, p2.user.username, p2.stats, spawnX2, spawnY);

  // Init bot states
  initBotState(room, p1.id, p1.stats, spawnX1 + 60, spawnY + 60);
  initBotState(room, p2.id, p2.stats, spawnX2 - 60, spawnY - 60);

  // Join socket room
  p1.join(room.id);
  p2.join(room.id);
  p1.roomId = room.id;
  p2.roomId = room.id;

  // Build initial game state
  const matchInfo = {
    roomId: room.id,
    players: {
      [p1.id]: {
        username: p1.user.username,
        x: spawnX1,
        y: spawnY,
      },
      [p2.id]: {
        username: p2.user.username,
        x: spawnX2,
        y: spawnY,
      },
    },
    bots: {
      [p1.id]: { x: spawnX1 + 60, y: spawnY + 60 },
      [p2.id]: { x: spawnX2 - 60, y: spawnY - 60 },
    },
    arena: { width: ARENA_W, height: ARENA_H },
    duration: MATCH_DURATION,
  };

  p1.emit("matchFound", { ...matchInfo, yourId: p1.id });
  p2.emit("matchFound", { ...matchInfo, yourId: p2.id });

  // Start the game loop
  startRoom(room, gameNsp);
  console.log(`Match created [${room.id}]: ${p1.user.username} vs ${p2.user.username}`);
}

/**
 * Remove a player from the queue.
 */
function removeFromQueue(socket) {
  const idx = queue.findIndex((s) => s.id === socket.id);
  if (idx !== -1) queue.splice(idx, 1);
  clearPlayerTimeout(socket.id);
}

/**
 * Clear a player's queue timeout.
 */
function clearPlayerTimeout(socketId) {
  const handle = timeouts.get(socketId);
  if (handle) {
    clearTimeout(handle);
    timeouts.delete(socketId);
  }
}

/**
 * Get current queue status (for REST endpoint).
 */
export function getQueueStatus() {
  // Purge disconnected
  for (let i = queue.length - 1; i >= 0; i--) {
    if (!queue[i].connected) {
      clearPlayerTimeout(queue[i].id);
      queue.splice(i, 1);
    }
  }

  return {
    queueSize: queue.length,
    activeRooms: rooms.size,
    players: queue.map((s, i) => ({
      username: s.user.username,
      position: i + 1,
    })),
  };
}

/**
 * Set up matchmaking Socket.io events on the game namespace.
 */
export default function setupMatchmaker(gameNsp) {
  gameNsp.on("connection", (socket) => {
    socket.on("findMatch", () => {
      enqueue(socket, gameNsp);
    });

    socket.on("cancelSearch", () => {
      const wasQueued = queue.some((s) => s.id === socket.id);
      removeFromQueue(socket);

      if (wasQueued) {
        socket.emit("searchCancelled", { message: "Matchmaking cancelled." });
        console.log(`Matchmaking: ${socket.user.username} cancelled search`);
      }
    });

    socket.on("disconnect", () => {
      removeFromQueue(socket);

      // Handle active room disconnect
      const room = rooms.get(socket.roomId);
      if (room && !room.matchEnded) {
        endMatch(room, gameNsp);
      }
    });
  });
}
