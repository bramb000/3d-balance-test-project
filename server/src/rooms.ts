import type { WebSocket } from "ws";
import type { ClientMessage, ServerMessage } from "@balance/shared";

type Room = {
  display?: WebSocket;
  controller?: WebSocket;
};

const rooms = new Map<string, Room>();

function generateRoomId(): string {
  return Math.random().toString(36).slice(2, 8);
}

function send(ws: WebSocket, message: ServerMessage): void {
  if (ws.readyState === ws.OPEN) {
    ws.send(JSON.stringify(message));
  }
}

export function createRoom(): string {
  let roomId = generateRoomId();
  while (rooms.has(roomId)) {
    roomId = generateRoomId();
  }
  rooms.set(roomId, {});
  return roomId;
}

export function joinRoom(
  roomId: string,
  role: "display" | "controller",
  ws: WebSocket
): boolean {
  let room = rooms.get(roomId);
  if (!room) {
    if (role === "display") {
      room = {};
      rooms.set(roomId, room);
    } else {
      return false;
    }
  }

  if (role === "display") {
    room.display = ws;
  } else {
    room.controller = ws;
    if (room.display) {
      send(room.display, { type: "controller_joined" });
    }
  }

  return true;
}

export function leaveRoom(roomId: string, ws: WebSocket): void {
  const room = rooms.get(roomId);
  if (!room) return;

  if (room.display === ws) {
    room.display = undefined;
  }
  if (room.controller === ws) {
    room.controller = undefined;
    if (room.display) {
      send(room.display, { type: "controller_left" });
    }
  }

  if (!room.display && !room.controller) {
    rooms.delete(roomId);
  }
}

export function relayControl(roomId: string, data: ClientMessage): void {
  if (data.type !== "control") return;
  const room = rooms.get(roomId);
  if (room?.display) {
    send(room.display, { type: "control", data: data.data });
  }
}

export function handleMessage(
  roomId: string,
  ws: WebSocket,
  raw: string
): void {
  try {
    const message = JSON.parse(raw) as ClientMessage;
    if (message.type === "join") {
      joinRoom(message.roomId, message.role, ws);
    } else if (message.type === "control") {
      relayControl(roomId, message);
    }
  } catch {
    // ignore malformed messages
  }
}
