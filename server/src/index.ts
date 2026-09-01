import express from "express";
import { createServer } from "http";
import path from "path";
import { existsSync } from "fs";
import { fileURLToPath } from "url";
import { WebSocketServer, WebSocket } from "ws";
import type { ClientMessage, ServerMessage } from "@balance/shared";
import {
  createRoom,
  handleMessage,
  joinRoom,
  leaveRoom,
} from "./rooms.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 3001;

const app = express();
const server = createServer(app);

const wss = new WebSocketServer({ server, path: "/ws" });

const wsRoomMap = new WeakMap<WebSocket, string>();

function send(ws: WebSocket, message: ServerMessage): void {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(message));
  }
}

wss.on("connection", (ws) => {
  ws.on("message", (data) => {
    const roomId = wsRoomMap.get(ws);
    if (!roomId) {
      try {
        const message = JSON.parse(data.toString()) as ClientMessage;
        if (message.type === "join") {
          let targetRoomId = message.roomId;

          if (message.role === "display" && !targetRoomId) {
            targetRoomId = createRoom();
            send(ws, { type: "room_created", roomId: targetRoomId });
          }

          const joined = joinRoom(targetRoomId, message.role, ws);
          if (joined) {
            wsRoomMap.set(ws, targetRoomId);
          }
        }
      } catch {
        // ignore
      }
    } else {
      handleMessage(roomId, ws, data.toString());
    }
  });

  ws.on("close", () => {
    const roomId = wsRoomMap.get(ws);
    if (roomId) {
      leaveRoom(roomId, ws);
      wsRoomMap.delete(ws);
    }
  });
});

function resolveClientDist(): string | null {
  const candidates = [
    path.join(__dirname, "public"),
    path.join(__dirname, "../../client/dist"),
    path.join(process.cwd(), "client/dist"),
  ];
  for (const dir of candidates) {
    if (existsSync(path.join(dir, "index.html"))) return dir;
  }
  return null;
}

const clientDist = resolveClientDist();

if (clientDist) {
  console.log(`Serving client from ${clientDist}`);
  app.use(express.static(clientDist));
  app.get("*", (_req, res) => {
    res.sendFile(path.join(clientDist, "index.html"));
  });
} else {
  console.warn("Client dist not found — run npm run build");
  app.get("/", (_req, res) => {
    res
      .status(503)
      .type("text")
      .send("Client not built. Check Render build logs.");
  });
}

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on http://0.0.0.0:${PORT}`);
  console.log(`WebSocket: ws://0.0.0.0:${PORT}/ws`);
});
