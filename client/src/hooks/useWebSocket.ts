import { useCallback, useEffect, useRef, useState } from "react";
import type { ClientMessage, ServerMessage } from "@balance/shared";

const ROOM_STORAGE_KEY = "balance-display-room";

function getWsUrl(): string {
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  const host = window.location.hostname;
  const port = import.meta.env.DEV ? "3001" : window.location.port;
  const portSuffix = port ? `:${port}` : "";
  return `${protocol}//${host}${portSuffix}/ws`;
}

function getDisplayRoomId(): string {
  try {
    return sessionStorage.getItem(ROOM_STORAGE_KEY) ?? "";
  } catch {
    return "";
  }
}

function saveDisplayRoomId(roomId: string): void {
  try {
    sessionStorage.setItem(ROOM_STORAGE_KEY, roomId);
  } catch {
    // ignore private browsing
  }
}

export function useWebSocket(role: "display" | "controller", roomId?: string) {
  const wsRef = useRef<WebSocket | null>(null);
  const [connected, setConnected] = useState(false);
  const [roomIdState, setRoomIdState] = useState(
    role === "display" ? getDisplayRoomId() : (roomId ?? "")
  );
  const [controllerConnected, setControllerConnected] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  const onControlRef = useRef<((data: ServerMessage) => void) | null>(null);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    const ws = new WebSocket(getWsUrl());
    wsRef.current = ws;

    ws.onopen = () => {
      setConnected(true);
      setJoinError(null);
      const joinMsg: ClientMessage = {
        type: "join",
        roomId:
          role === "display" ? getDisplayRoomId() : (roomId ?? ""),
        role,
      };
      ws.send(JSON.stringify(joinMsg));
    };

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data) as ServerMessage;
        if (message.type === "room_created") {
          setRoomIdState(message.roomId);
          saveDisplayRoomId(message.roomId);
        } else if (message.type === "join_failed") {
          setJoinError(message.reason);
          setConnected(false);
        } else if (message.type === "controller_joined") {
          setControllerConnected(true);
        } else if (message.type === "controller_left") {
          setControllerConnected(false);
        } else if (message.type === "control") {
          setControllerConnected(true);
          onControlRef.current?.(message);
        }
      } catch {
        // ignore
      }
    };

    ws.onclose = () => {
      setConnected(false);
      setControllerConnected(false);
    };
  }, [role, roomId]);

  useEffect(() => {
    connect();
    return () => {
      wsRef.current?.close();
    };
  }, [connect]);

  const send = useCallback((message: ClientMessage) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    }
  }, []);

  const onControl = useCallback((handler: (data: ServerMessage) => void) => {
    onControlRef.current = handler;
  }, []);

  return {
    connected,
    roomId: roomIdState,
    controllerConnected,
    joinError,
    send,
    onControl,
  };
}
