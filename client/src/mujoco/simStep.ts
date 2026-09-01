import type { MjData, MjModel } from "./types";
import { applyControls, getTorsoTilt } from "../physics/applyControls";

export function simStep(
  mujoco: { mj_step: (m: MjModel, d: MjData) => void },
  model: MjModel,
  data: MjData,
  substeps = 2
): number {
  applyControls(data, model);
  for (let i = 0; i < substeps; i++) {
    mujoco.mj_step(model, data);
  }
  return getTorsoTilt(data, model);
}

export function settleSimulation(
  mujoco: { mj_forward: (m: MjModel, d: MjData) => void },
  model: MjModel,
  data: MjData,
  steps = 50
): void {
  for (let i = 0; i < steps; i++) {
    mujoco.mj_forward(model, data);
  }
}
