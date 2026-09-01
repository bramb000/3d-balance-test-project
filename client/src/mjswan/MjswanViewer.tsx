import { useEffect, useRef } from "react";
import type { ControlPacket } from "@balance/shared";
import { createEngine, type MjswanEngine } from "mjswan";
import { parseManifest } from "mjswan/manifest";
import type { CameraMode } from "../config/controls";
import { MAX_WALK_SPEED_MPS } from "../config/controls";

/** Public mjswan demo assets (Unitree Go2 + trained policies). */
const REMOTE_BASE = "https://ttktjmt.github.io/mjswan/main/assets/";

type Props = {
  controlRef: React.MutableRefObject<ControlPacket>;
  cameraMode: CameraMode;
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

export function MjswanViewer({
  controlRef,
  cameraMode,
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

    let controlTimer: ReturnType<typeof setInterval> | undefined;
    let cancelled = false;

    async function init() {
      const configRes = await fetch("/mjswan/config.json");
      if (!configRes.ok) throw new Error("Missing mjswan config.json");
      const config = await configRes.json();

      const byteSource = (relPath: string) => async () => {
        const url = `${REMOTE_BASE}${relPath.replace(/^main\/assets\//, "")}`;
        const res = await fetch(url);
        if (!res.ok) throw new Error(`Asset fetch failed: ${url}`);
        return res.arrayBuffer();
      };

      const catalog = parseManifest(config, byteSource);
      const project = catalog.projects[0];
      const sceneEntry = project.scenes.find((s) => s.name === "Go2") ?? project.scenes[0];

      const engine = await createEngine(container!);
      if (cancelled) {
        engine.dispose();
        return;
      }

      await engine.loadScene(await sceneEntry.buildScene({ policy: "Vanilla" }));
      applyCameraMode(engine, cameraModeRef.current);
      engine.play();

      engineRef.current = engine;
      onReady();

      controlTimer = setInterval(() => {
        const { coarse, fine } = controlRef.current;
        engine.commands.set("velocity:lin_vel_x", coarse.y * MAX_WALK_SPEED_MPS);
        engine.commands.set("velocity:lin_vel_y", coarse.x * MAX_WALK_SPEED_MPS);
        engine.commands.set("velocity:ang_vel_z", fine.roll * 0.35);
      }, 50);
    }

    init().catch((err) => {
      onError(err instanceof Error ? err.message : String(err));
    });

    return () => {
      cancelled = true;
      if (controlTimer) clearInterval(controlTimer);
      engineRef.current?.dispose();
      engineRef.current = null;
    };
  }, [controlRef, onError, onReady]);

  useEffect(() => {
    const engine = engineRef.current;
    if (engine) applyCameraMode(engine, cameraMode);
  }, [cameraMode]);

  return <div ref={containerRef} className="mjswan-viewport" />;
}
