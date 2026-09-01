import type { ControlPacket } from "@balance/shared";
import { COARSE_FORCE, FINE_TORQUE } from "../config/controls";
import { TORSO_BODY } from "../mujoco/generateMjcf";
import type { MjData, MjModel } from "../mujoco/types";

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

export function clearAppliedForces(data: MjData): void {
  const xfrc = data.xfrc_applied as Float64Array;
  xfrc.fill(0);
}

export function applyControls(data: MjData, model: MjModel): void {
  clearAppliedForces(data);
  const { coarse, fine } = latestControl;

  const bodyId = model.body(TORSO_BODY).id;
  const xfrc = data.xfrc_applied as Float64Array;
  const base = bodyId * 6;

  // MuJoCo frame: X right, Y forward, Z up (world-frame force/torque on torso)
  xfrc[base + 0] = coarse.x * COARSE_FORCE;
  xfrc[base + 1] = -coarse.y * COARSE_FORCE;
  xfrc[base + 3] = fine.roll * FINE_TORQUE;
  xfrc[base + 4] = -fine.pitch * FINE_TORQUE;
}

export function getTorsoTilt(data: MjData, model: MjModel): number {
  const bodyId = model.body(TORSO_BODY).id;
  const xquat = data.xquat as Float64Array;
  const offset = bodyId * 4;
  const w = xquat[offset];
  const x = xquat[offset + 1];
  const y = xquat[offset + 2];
  void w;

  // MuJoCo Z-up: tilt from vertical (Z axis)
  const upZ = 1 - 2 * (x * x + y * y);
  const tilt = Math.acos(Math.min(1, Math.max(-1, upZ))) * (180 / Math.PI);
  return tilt;
}

export function getTorsoPosition(
  data: MjData,
  model: MjModel
): [number, number, number] {
  const bodyId = model.body(TORSO_BODY).id;
  const xpos = data.xpos as Float64Array;
  const i = bodyId * 3;
  return [xpos[i], xpos[i + 1], xpos[i + 2]];
}
