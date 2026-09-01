import type { RapierRigidBody } from "@react-three/rapier";
import type { ControlPacket } from "@balance/shared";
import { COARSE_FORCE, FINE_TORQUE } from "../config/controls";

let latestControl: ControlPacket = {
  t: 0,
  coarse: { x: 0, y: 0 },
  fine: { pitch: 0, roll: 0 },
};

export function setLatestControl(packet: ControlPacket): void {
  latestControl = packet;
}

export function getLatestControl(): ControlPacket {
  return latestControl;
}

export function applyControls(body: RapierRigidBody): void {
  const { coarse, fine } = latestControl;

  body.applyImpulse(
    { x: coarse.x * COARSE_FORCE * 0.05, y: 0, z: -coarse.y * COARSE_FORCE * 0.05 },
    true
  );

  body.applyTorqueImpulse(
    {
      x: fine.roll * FINE_TORQUE * 0.02,
      y: 0,
      z: -fine.pitch * FINE_TORQUE * 0.02,
    },
    true
  );
}

export function getBodyTilt(body: RapierRigidBody): number {
  const rot = body.rotation();
  const up = { x: 0, y: 1, z: 0 };
  const q = rot;
  const rotatedY =
    2 * (q.w * q.y + q.x * q.z);
  const rotatedX =
    2 * (q.w * q.x - q.y * q.z);
  const rotatedZ =
    1 - 2 * (q.x * q.x + q.y * q.y);
  void rotatedX;
  void rotatedZ;
  void up;
  const tiltFromVertical = Math.acos(Math.min(1, Math.abs(rotatedY)));
  return (tiltFromVertical * 180) / Math.PI;
}
