import type { MjData, MjModel } from "./types";
import { applyControls, getTorsoTilt } from "../physics/applyControls";

const FIXED_DT = 0.005;
const STEPS_PER_FRAME = 3;

export function simStep(
  mujoco: { mj_step: (m: MjModel, d: MjData) => void },
  model: MjModel,
  data: MjData
): number {
  applyControls(data, model, FIXED_DT * STEPS_PER_FRAME);
  for (let i = 0; i < STEPS_PER_FRAME; i++) {
    mujoco.mj_step(model, data);
  }
  return getTorsoTilt(data, model);
}

export function settleSimulation(
  mujoco: {
    mj_forward: (m: MjModel, d: MjData) => void;
    mj_step: (m: MjModel, d: MjData) => void;
  },
  model: MjModel,
  data: MjData,
  steps = 300
): void {
  mujoco.mj_forward(model, data);
  for (let i = 0; i < steps; i++) {
    mujoco.mj_step(model, data);
  }
  mujoco.mj_forward(model, data);
}

export { FIXED_DT, STEPS_PER_FRAME };
