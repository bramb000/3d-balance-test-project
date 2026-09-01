import type { ControlPacket } from "@balance/shared";
import {
  FINE_BALANCE_GAIN,
  MAX_WALK_SPEED_MPS,
  STEP_CLEARANCE,
  STEP_LENGTH,
  SWING_DURATION,
} from "../config/controls";
import { solveLegIk } from "./legIk";
import {
  sampleTerrainHeight,
  sampleTerrainHeightUnderBody,
} from "./terrainSampler";
import { getViewFrame } from "./viewFrame";
import {
  ATTACH_R,
  FEMUR_LEN,
  FOOT_R,
  FOOT_SPHERE_R,
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

export function setLatestControl(packet: ControlPacket): void {
  latestControl = packet;
}

export function getLatestControl(): ControlPacket {
  return latestControl;
}

export function resetLocomotion(legCount: number): void {
  gaitPhase = 0;
  cachedLegCount = legCount;
}

function getBodyPose(data: MjData, model: MjModel) {
  const bodyId = model.body(TORSO_BODY).id;
  const xpos = data.xpos as Float64Array;
  const xquat = data.xquat as Float64Array;
  const i = bodyId * 3;
  const q = bodyId * 4;
  const w = xquat[q];
  const x = xquat[q + 1];
  const y = xquat[q + 2];
  const z = xquat[q + 3];

  const siny = 2 * (w * z + x * y);
  const cosy = 1 - 2 * (y * y + z * z);
  const yaw = Math.atan2(siny, cosy);

  return {
    x: xpos[i],
    y: xpos[i + 1],
    z: xpos[i + 2],
    yaw,
    w,
    qx: x,
    qy: y,
    qz: z,
  };
}

function computeDesiredVelocity(coarse: { x: number; y: number }): [number, number] {
  const { forward, right } = getViewFrame();
  const vx =
    (forward[0] * coarse.y + right[0] * coarse.x) * MAX_WALK_SPEED_MPS;
  const vy =
    (forward[1] * coarse.y + right[1] * coarse.x) * MAX_WALK_SPEED_MPS;
  const mag = Math.hypot(vx, vy);
  if (mag > MAX_WALK_SPEED_MPS) {
    const s = MAX_WALK_SPEED_MPS / mag;
    return [vx * s, vy * s];
  }
  return [vx, vy];
}

function footTargetForLeg(
  legIndex: number,
  legCount: number,
  body: ReturnType<typeof getBodyPose>,
  desiredVel: [number, number],
  phase: number,
  isSwing: boolean
): [number, number, number] {
  const attachAngle = (legIndex / legCount) * Math.PI * 2;
  const cosA = Math.cos(attachAngle);
  const sinA = Math.sin(attachAngle);

  const speed = Math.hypot(desiredVel[0], desiredVel[1]);
  const moveYaw =
    speed > 0.02 ? Math.atan2(desiredVel[1], desiredVel[0]) : body.yaw;

  const cosY = Math.cos(moveYaw);
  const sinY = Math.sin(moveYaw);

  const radialX = cosA * FOOT_R;
  const radialY = sinA * FOOT_R;

  const stepOffset = isSwing
    ? STEP_LENGTH * Math.sin(phase * Math.PI)
    : -STEP_LENGTH * 0.35;

  const localX = radialX + cosY * stepOffset;
  const localY = radialY + sinY * stepOffset;

  const worldX = body.x + localX;
  const worldY = body.y + localY;
  const groundZ = sampleTerrainHeight(worldX, worldY) + FOOT_SPHERE_R;
  const lift = isSwing ? STEP_CLEARANCE * Math.sin(phase * Math.PI) : 0;

  return [worldX, worldY, groundZ + lift];
}

function worldFootToLocalIk(
  footWorld: [number, number, number],
  attachAngle: number,
  body: ReturnType<typeof getBodyPose>
): { hip: number; knee: number } | null {
  const cosA = Math.cos(attachAngle);
  const sinA = Math.sin(attachAngle);

  const relX = footWorld[0] - body.x;
  const relY = footWorld[1] - body.y;
  const relZ = footWorld[2] - body.z;

  const hipX = cosA * ATTACH_R;
  const hipY = sinA * ATTACH_R;
  const hipZ = -TORSO_HALF_H;

  const dx = relX - hipX;
  const dy = relY - hipY;
  const dz = relZ - hipZ;

  const planeX = cosA * dx + sinA * dy;
  const planeZ = dz;

  return solveLegIk(planeX, planeZ, FEMUR_LEN, TIBIA_LEN);
}

export function applyControls(
  data: MjData,
  model: MjModel,
  dt: number
): void {
  const xfrc = data.xfrc_applied as Float64Array;
  xfrc.fill(0);

  const legCount = cachedLegCount || Math.floor(model.nu / 2);
  if (!cachedLegCount) cachedLegCount = legCount;

  const body = getBodyPose(data, model);
  const { coarse, fine } = latestControl;
  const desiredVel = computeDesiredVelocity(coarse);
  const speed = Math.hypot(desiredVel[0], desiredVel[1]);

  gaitPhase +=
    (speed / Math.max(STEP_LENGTH, 0.01)) * dt * (SWING_DURATION * 0.5 + 0.5);
  if (gaitPhase > 1) gaitPhase -= Math.floor(gaitPhase);

  const terrainUnder = sampleTerrainHeightUnderBody(body.x, body.y, FOOT_R * 0.6);
  const targetBodyZ =
    terrainUnder + FEMUR_LEN + TIBIA_LEN * 0.85 + TORSO_HALF_H + FOOT_SPHERE_R;
  const heightErr = targetBodyZ - body.z;
  const bodyId = model.body(TORSO_BODY).id;
  const base = bodyId * 6;
  xfrc[base + 2] = heightErr * 18 - (data.qvel?.[2] ?? 0) * 4;
  xfrc[base + 3] = fine.roll * FINE_BALANCE_GAIN;
  xfrc[base + 4] = -fine.pitch * FINE_BALANCE_GAIN;

  if (speed > 0.02) {
    const push = Math.min(speed / MAX_WALK_SPEED_MPS, 1) * 12;
    xfrc[base + 0] += desiredVel[0] * push;
    xfrc[base + 1] += desiredVel[1] * push;
  }

  const ctrl = data.ctrl as Float64Array;

  for (let i = 0; i < legCount; i++) {
    const legPhase = (gaitPhase + i / legCount) % 1;
    const isSwing = legPhase > 0.5;
    const swingT = isSwing ? (legPhase - 0.5) * 2 : 0;

    const footWorld = footTargetForLeg(
      i,
      legCount,
      body,
      desiredVel,
      swingT,
      isSwing
    );

    const attachAngle = (i / legCount) * Math.PI * 2;
    let ik = worldFootToLocalIk(footWorld, attachAngle, body);

    if (!ik) {
      ik = { hip: 0.55, knee: -1.1 };
    }

    const hipAct = model.actuator(`hip${i}_act`).id;
    const kneeAct = model.actuator(`knee${i}_act`).id;
    ctrl[hipAct] = ik.hip;
    ctrl[kneeAct] = ik.knee;
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
  const body = getBodyPose(data, model);
  return { yaw: body.yaw, pos: [body.x, body.y, body.z] };
}

export function getWalkSpeedMps(coarse: { x: number; y: number }): number {
  const [vx, vy] = computeDesiredVelocity(coarse);
  return Math.hypot(vx, vy);
}
