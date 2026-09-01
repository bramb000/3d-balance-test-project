export type Role = "display" | "controller";

export type ControlPacket = {
  t: number;
  coarse: { x: number; y: number };
  fine: { pitch: number; roll: number };
};

export type ServerMessage =
  | { type: "room_created"; roomId: string }
  | { type: "controller_joined" }
  | { type: "controller_left" }
  | { type: "control"; data: ControlPacket };

export type ClientMessage =
  | { type: "join"; roomId: string; role: Role }
  | { type: "control"; data: ControlPacket };
