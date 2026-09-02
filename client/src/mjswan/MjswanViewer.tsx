import { useEffect, useRef } from "react";
import type { ControlPacket } from "@balance/shared";
import { createEngine, type MjswanEngine } from "mjswan";
import { parseManifest } from "mjswan/manifest";
import type { CameraMode } from "../config/controls";
import {
  IDLE_FORWARD_MPS,
  INPUT_DEADZONE,
  MAX_ANG_VEL,
  MAX_LAT_VEL_MPS,
  MAX_WALK_SPEED_MPS,
  SETTLE_MS,
} from "../config/controls";

/** Public mjswan demo assets (Unitree Go2 + trained policies). */
const REMOTE_BASE = "https://ttktjmt.github.io/mjswan/main/assets/";

type Props = {
  controlRef: React.MutableRefObject<ControlPacket>;
  cameraMode: CameraMode;
  resetRef?: React.MutableRefObject<(() => void) | null>;
  onReady: () => void;
  onError: (message: string) => void;
};

function applyCameraMode(engine: MjswanEngine, mode: CameraMode): void {
  const view = engine.camera.get();
  if (mode === "first") {
    engine.camera.set({
      distance: 0.35,
      elevation: -8,
      fovy: 72,
    });
  } else {
    engine.camera.set({
      distance: 3.8,
      elevation: -20,
      fovy: 50,
      lookat: view.lookat,
    });
  }
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

/**
 * Map phone/keyboard into Go2 velocity commands.
 * Returns false when we should leave the policy UI defaults alone (spawn settle).
 */
function applyVelocityCommands(
  engine: MjswanEngine,
  control: ControlPacket,
  keys: { forward: number; strafe: number; yaw: number },
  opts: { settled: boolean; engaged: boolean },
): boolean {
  const { coarse, fine } = control;
  const forward = clamp(coarse.y + keys.forward, -1, 1);
  const strafe = clamp(coarse.x + keys.strafe, -1, 1);
  // Ignore tiny gyro noise — phone tilt was tipping the dog at spawn.
  const yawStick = Math.abs(fine.roll) > INPUT_DEADZONE ? fine.roll : 0;
  const yaw = clamp(yawStick + keys.yaw, -1, 1);
  const magnitude = Math.hypot(forward, strafe, yaw);
  const active = magnitude > INPUT_DEADZONE;

  if (!opts.settled && !active) {
    // Keep Vanilla/Robust UI defaults (lin_vel_x=0.5). Zeroing at spawn tips the dog.
    return false;
  }

  if (active || opts.engaged) {
    engine.commands.set(
      "velocity:lin_vel_x",
      active ? forward * MAX_WALK_SPEED_MPS : IDLE_FORWARD_MPS,
    );
    engine.commands.set(
      "velocity:lin_vel_y",
      active ? strafe * MAX_LAT_VEL_MPS : 0,
    );
    engine.commands.set(
      "velocity:ang_vel_z",
      active ? yaw * MAX_ANG_VEL : 0,
    );
    return active;
  }

  engine.commands.set("velocity:lin_vel_x", IDLE_FORWARD_MPS);
  engine.commands.set("velocity:lin_vel_y", 0);
  engine.commands.set("velocity:ang_vel_z", 0);
  return false;
}

export function MjswanViewer({
  controlRef,
  cameraMode,
  resetRef,
  onReady,
  onError,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<MjswanEngine | null>(null);
  const cameraModeRef = useRef(cameraMode);
  cameraModeRef.current = cameraMode;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let cancelled = false;
    let engine: MjswanEngine | null = null;
    let controlTimer: ReturnType<typeof setInterval> | undefined;
    let settleTimer: ReturnType<typeof setTimeout> | undefined;
    let settled = false;
    let engaged = false;
    const keys = { forward: 0, strafe: 0, yaw: 0 };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) return;
      if (e.key === "w" || e.key === "ArrowUp") keys.forward = 1;
      if (e.key === "s" || e.key === "ArrowDown") keys.forward = -1;
      if (e.key === "a" || e.key === "ArrowLeft") keys.strafe = 1;
      if (e.key === "d" || e.key === "ArrowRight") keys.strafe = -1;
      if (e.key === "q") keys.yaw = 1;
      if (e.key === "e") keys.yaw = -1;
      if (e.key === "r" || e.key === "R") engineRef.current?.reset();
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === "w" || e.key === "ArrowUp" || e.key === "s" || e.key === "ArrowDown") {
        keys.forward = 0;
      }
      if (e.key === "a" || e.key === "ArrowLeft" || e.key === "d" || e.key === "ArrowRight") {
        keys.strafe = 0;
      }
      if (e.key === "q" || e.key === "e") keys.yaw = 0;
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);

    async function init() {
      const configRes = await fetch("/mjswan/config.json");
      if (!configRes.ok) throw new Error("Missing mjswan config.json");
      const config = await configRes.json();
      if (cancelled) return;

      const byteSource = (relPath: string) => async () => {
        const url = `${REMOTE_BASE}${relPath.replace(/^main\/assets\//, "")}`;
        const res = await fetch(url);
        if (!res.ok) throw new Error(`Asset fetch failed: ${url}`);
        return res.arrayBuffer();
      };

      const catalog = parseManifest(config, byteSource);
      const project = catalog.projects[0];
      const sceneEntry =
        project.scenes.find((s) => s.name === "Go2") ?? project.scenes[0];

      engine = await createEngine(container!);
      if (cancelled) {
        engine.dispose();
        engine = null;
        return;
      }

      // Robust is the same velocity interface as Vanilla, tuned to disturb less.
      await engine.loadScene(await sceneEntry.buildScene({ policy: "Robust" }));
      if (cancelled) {
        engine.dispose();
        engine = null;
        return;
      }

      const commandIds = engine.getState().commands.map((c) => c.id);
      if (!commandIds.includes("velocity:lin_vel_x")) {
        throw new Error(
          `Go2 velocity commands missing after load (got: ${commandIds.join(", ") || "none"})`,
        );
      }

      applyCameraMode(engine, cameraModeRef.current);
      engine.reset();
      engine.play();
      // Do not overwrite policy defaults here — default lin_vel_x=0.5 keeps it upright.

      engineRef.current = engine;
      if (resetRef) {
        resetRef.current = () => {
          engine?.reset();
        };
      }
      onReady();

      settleTimer = setTimeout(() => {
        settled = true;
      }, SETTLE_MS);

      controlTimer = setInterval(() => {
        if (!engine) return;
        const becameActive = applyVelocityCommands(engine, controlRef.current, keys, {
          settled,
          engaged,
        });
        if (becameActive) engaged = true;
      }, 50);
    }

    init().catch((err) => {
      if (cancelled) return;
      onError(err instanceof Error ? err.message : String(err));
    });

    return () => {
      cancelled = true;
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      if (controlTimer) clearInterval(controlTimer);
      if (settleTimer) clearTimeout(settleTimer);
      if (resetRef) resetRef.current = null;
      engine?.dispose();
      engine = null;
      engineRef.current = null;
    };
  }, [controlRef, onError, onReady, resetRef]);

  useEffect(() => {
    const engine = engineRef.current;
    if (engine) applyCameraMode(engine, cameraMode);
  }, [cameraMode]);

  return <div ref={containerRef} className="mjswan-viewport" />;
}
