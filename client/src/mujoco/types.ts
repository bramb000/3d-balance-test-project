import type { MainModule, MjData, MjModel } from "@mujoco/mujoco";

export type MjModule = MainModule;

export interface MujocoState {
  mujoco: MainModule;
  model: MjModel;
  data: MjData;
}

export type { MjData, MjModel, MainModule };
