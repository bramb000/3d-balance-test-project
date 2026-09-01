import { useCallback, useEffect, useState } from "react";
import loadMujoco from "@mujoco/mujoco";
import { generateMjcf } from "./generateMjcf";
import { settleSimulation } from "./simStep";
import type { MjData, MjModel, MjModule, MujocoState } from "./types";

const MODEL_PATH = "/model.xml";

let mujocoModulePromise: Promise<MjModule> | null = null;

function loadMujocoModule(): Promise<MjModule> {
  if (!mujocoModulePromise) {
    mujocoModulePromise = loadMujoco();
  }
  return mujocoModulePromise;
}

function loadModel(
  mujoco: MjModule,
  legCount: number
): { model: MjModel; data: MjData } {
  try {
    mujoco.FS.unlink(MODEL_PATH);
  } catch {
    // file may not exist yet
  }
  const xml = generateMjcf(legCount);
  mujoco.FS.writeFile(MODEL_PATH, xml);
  const model = mujoco.MjModel.from_xml_path(MODEL_PATH);
  const data = new mujoco.MjData(model);
  settleSimulation(mujoco, model, data, 200);
  return { model, data };
}

export function useMujoco(legCount: number) {
  const [simState, setSimState] = useState<MujocoState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const dispose = useCallback((state: MujocoState | null) => {
    if (state) {
      state.data.delete();
      state.model.delete();
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    let current: MujocoState | null = null;

    async function init() {
      setLoading(true);
      setError(null);
      setSimState(null);
      try {
        const mujoco = await loadMujocoModule();
        if (cancelled) return;
        const { model, data } = loadModel(mujoco, legCount);
        current = { mujoco, model, data };
        if (!cancelled) {
          setSimState(current);
        } else {
          dispose(current);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : String(e));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    init();

    return () => {
      cancelled = true;
      dispose(current);
    };
  }, [legCount, dispose]);

  return {
    simState,
    loading,
    error,
    ready: simState !== null && !loading,
  };
}
