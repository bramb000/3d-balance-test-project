import type { ControlPacket } from "@balance/shared";
import {
  BODY_CLEARANCE,
  FINE_BALANCE_GAIN,
  MAX_WALK_SPEED_MPS,
  STEP_CLEARANCE,
  STEP_LENGTH,
} from "../config/controls";
import { solveLegIk } from "./legIk";
import { sampleTerrainHeight } from "./terrainSampler";
import { getViewFrame } from "./viewFrame";
import {
  ATTACH_R,
  FEMUR_LEN,
  FOOT_R,
  FOOT_SPHERE_R,
  MOCAP_BODY,
  TIBIA_LEN,
  TORSO_BODY,
  TORSO_HALF_H,
} from "../mujoco/generateMjcf";
import type { MjData, MjModel } from "../mujoco/types";

let latestControl: ControlPacket = {
  t: 0,
  coarse: { x: 0, y: 0 },
  fine: { pitch: 0, roll: 0 },
};

let gaitPhase = 0;
let cachedLegCount = 0;
let mocapPos = { x: 0, y: 0, z: 0.95 };
let mocapYaw = 0;

export function setLatestControl(packet: ControlPacket): void {
  latestControl = packet;
}

export function getLatestControl(): ControlPacket {
  return latestControl;
}

export function resetLocomotion(legCount: number): void {
  gaitPhase = 0;
  cachedLegCount = legCount;
  mocapPos = { x: 0, y: 0, z: 0.95 };
  mocapYaw = 0;
}

function computeDesiredVelocity(coarse: { x: number; y: number }): [number, number] {
  const { forward, right } = getViewFrame();
  let vx = (forward[0] * coarse.y + right[0] * coarse.x) * MAX_WALK_SPEED_MPS;
  let vy = (forward[1] * coarse.y + right[1] * coarse.x) * MAX_WALK_SPEED_MPS;
  const mag = Math.hypot(vx, vy);
  if (mag > MAX_WALK_SPEED_MPS) {
    const s = MAX_WALK_SPEED_MPS / mag;
    vx *= s;
    vy *= s;
  }
  return [vx, vy];
}

function worldFootToLocalIk(
  footWorld: [number, number, number],
  attachAngle: number,
  bodyX: number,
  bodyY: number,
  bodyZ: number
): { hip: number; knee: number } | null {
  const cosA = Math.cos(attachAngle);
  const sinA = Math.sin(attachAngle);
  const hipX = cosA * ATTACH_R;
  const hipY = sinA * ATTACH_R;
  const hipZ = -TORSO_HALF_H;

  const dx = footWorld[0] - bodyX - hipX;
  const dy = footWorld[1] - bodyY - hipY;
  const dz = footWorld[2] - bodyZ - hipZ;

  const planeX = cosA * dx + sinA * dy;
  const planeZ = dz;
  return solveLegIk(planeX, planeZ, FEMUR_LEN, TIBIA_LEN);
}

export function applyControls(data: MjData, model: MjModel, dt: number): void {
  const xfrc = data.xfrc_applied as Float64Array;
  xfrc.fill(0);

  const legCount = cachedLegCount || Math.floor(model.nu / 2);
  if (!cachedLegCount) cachedLegCount = legCount;

  const { coarse, fine } = latestControl;
  const [vx, vy] = computeDesiredVelocity(coarse);
  const speed = Math.hypot(vx, vy);

  if (speed > 0.01) {
    mocapYaw = Math.atan2(vy, vx);
  }

  mocapPos.x += vx * dt;
  mocapPos.y += vy * dt;
  const groundZ =
    sampleTerrainHeight(mocapPos.x, mocapPos.y) +
    BODY_CLEARANCE +
    TORSO_HALF_H +
    FOOT_SPHERE_R;
  mocapPos.z += (groundZ - mocapPos.z) * Math.min(1, dt * 6);

  const mocapId = model.body(MOCAP_BODY).id;
  const mocapPosArr = data.mocap_pos as Float64Array;
  const mocapQuatArr = data.mocap_quat as Float64Array;
  const mp = mocapId * 3;
  const mq = mocapId * 4;
  mocapPosArr[mp] = mocapPos.x;
  mocapPosArr[mp + 1] = mocapPos.y;
  mocapPosArr[mp + 2] = mocapPos.z;

  const half = mocapYaw * 0.5;
  mocapQuatArr[mq] = Math.cos(half);
  mocapQuatArr[mq + 1] = 0;
  mocapQuatArr[mq + 2] = 0;
  mocapQuatArr[mq + 3] = Math.sin(half);

  gaitPhase += speed * dt * 2.2;
  if (gaitPhase > 1) gaitPhase -= Math.floor(gaitPhase);

  const bodyId = model.body(TORSO_BODY).id;
  const xpos = data.xpos as Float64Array;
  const bi = bodyId * 3;
  const bodyX = xpos[bi];
  const bodyY = xpos[bi + 1];
  const bodyZ = xpos[bi + 2];

  const base = bodyId * 6;
  xfrc[base + 3] = fine.roll * FINE_BALANCE_GAIN * 0.3;
  xfrc[base + 4] = -fine.pitch * FINE_BALANCE_GAIN * 0.3;

  const ctrl = data.ctrl as Float64Array;
  const cosY = Math.cos(mocapYaw);
  const sinY = Math.sin(mocapYaw);

  for (let i = 0; i < legCount; i++) {
    const legPhase = (gaitPhase + i / legCount) % 1;
    const isSwing = legPhase > 0.5;
    const swingT = isSwing ? (legPhase - 0.5) * 2 : 0;
    const attachAngle = (i / legCount) * Math.PI * 2;

    const radialX = Math.cos(attachAngle) * FOOT_R;
    const radialY = Math.sin(attachAngle) * FOOT_R;
    const stepOffset = isSwing
      ? STEP_LENGTH * swingT
      : -STEP_LENGTH * 0.25 * (1 - swingT);

    const localX = radialX + cosY * stepOffset;
    const localY = radialY + sinY * stepOffset;
    const worldX = mocapPos.x + localX;
    const worldY = mocapPos.y + localY;
    const ground = sampleTerrainHeight(worldX, worldY) + FOOT_SPHERE_R;
    const lift = isSwing ? STEP_CLEARANCE * Math.sin(swingT * Math.PI) : 0;

    let ik = worldFootToLocalIk(
      [worldX, worldY, ground + lift],
      attachAngle,
      bodyX,
      bodyY,
      bodyZ
    );
    if (!ik) ik = { hip: 0.45, knee: -0.95 };

    ctrl[model.actuator(`hip${i}_act`).id] = ik.hip;
    ctrl[model.actuator(`knee${i}_act`).id] = ik.knee;
  }
}

export function getTorsoTilt(data: MjData, model: MjModel): number {
  const bodyId = model.body(TORSO_BODY).id;
  const xquat = data.xquat as Float64Array;
  const offset = bodyId * 4;
  const x = xquat[offset + 1];
  const y = xquat[offset + 2];
  const upZ = 1 - 2 * (x * x + y * y);
  return Math.acos(Math.min(1, Math.max(-1, upZ))) * (180 / Math.PI);
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

export function getTorsoOrientation(
  data: MjData,
  model: MjModel
): { yaw: number; pos: [number, number, number] } {
  const bodyId = model.body(TORSO_BODY).id;
  const xquat = data.xquat as Float64Array;
  const xpos = data.xpos as Float64Array;
  const q = bodyId * 4;
  const i = bodyId * 3;
  const w = xquat[q];
  const x = xquat[q + 1];
  const y = xquat[q + 2];
  const z = xquat[q + 3];
  const siny = 2 * (w * z + x * y);
  const cosy = 1 - 2 * (y * y + z * z);
  return {
    yaw: Math.atan2(siny, cosy),
    pos: [xpos[i], xpos[i + 1], xpos[i + 2]],
  };
}

export function getWalkSpeedMps(coarse: { x: number; y: number }): number {
  const [vx, vy] = computeDesiredVelocity(coarse);
  return Math.hypot(vx, vy);
}
