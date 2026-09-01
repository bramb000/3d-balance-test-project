import { useCallback, useEffect, useRef, useState } from "react";
import type { ControlPacket } from "@balance/shared";
import { QRCode } from "../components/QRCode";
import { useWebSocket } from "../hooks/useWebSocket";
import { MjswanViewer } from "../mjswan/MjswanViewer";
import type { CameraMode } from "../config/controls";
import { MAX_WALK_SPEED_KMH } from "../config/controls";
import "../styles/display.css";

const defaultControl: ControlPacket = {
  t: 0,
  coarse: { x: 0, y: 0 },
  fine: { pitch: 0, roll: 0 },
};

export function DisplayPage() {
  const [simReady, setSimReady] = useState(false);
  const [simError, setSimError] = useState<string | null>(null);
  const [cameraMode, setCameraMode] = useState<CameraMode>("third");
  const [liveInput, setLiveInput] = useState({
    coarseX: 0,
    coarseY: 0,
    fineP: 0,
    fineR: 0,
  });
  const controlRef = useRef<ControlPacket>(defaultControl);
  const { connected, roomId, controllerConnected, onControl } =
    useWebSocket("display");

  const handleSimReady = useCallback(() => setSimReady(true), []);
  const handleSimError = useCallback((message: string) => {
    setSimError(message);
    setSimReady(false);
  }, []);

  useEffect(() => {
    onControl((msg) => {
      if (msg.type === "control") {
        controlRef.current = msg.data;
        setLiveInput({
          coarseX: msg.data.coarse.x,
          coarseY: msg.data.coarse.y,
          fineP: msg.data.fine.pitch,
          fineR: msg.data.fine.roll,
        });
      }
    });
  }, [onControl]);

  useEffect(() => {
    if (!controllerConnected) {
      controlRef.current = { ...defaultControl, t: Date.now() };
    }
  }, [controllerConnected]);

  const controllerUrl = roomId
    ? `${window.location.protocol}//${window.location.hostname}${window.location.port ? `:${window.location.port}` : ""}/controller/${roomId}`
    : "";

  const walkSpeedKmh =
    Math.hypot(liveInput.coarseX, liveInput.coarseY) * MAX_WALK_SPEED_KMH;

  return (
    <div className="display-page">
      <MjswanViewer
        controlRef={controlRef}
        cameraMode={cameraMode}
        onReady={handleSimReady}
        onError={handleSimError}
      />

      {!simReady && !simError && (
        <div className="loading-overlay">
          <div className="loading-spinner" />
          <p className="loading-text">Loading Unitree Go2 simulation…</p>
          <p className="loading-detail">Powered by mjswan + trained locomotion policy</p>
        </div>
      )}

      {simError && (
        <div className="loading-overlay">
          <p className="loading-error">Simulation error</p>
          <p className="loading-detail">{simError}</p>
        </div>
      )}

      <div className="hud-overlay">
        <div className="hud-panel hud-top-left">
          <h1>Balance Robot</h1>
          <p className="robot-model-label">Unitree Go2 · mjswan</p>
          <div className="status-row">
            <span className={`status-dot ${connected ? "online" : ""}`} />
            {connected ? "Connected" : "Connecting..."}
          </div>
          <div className="status-row">
            <span
              className={`status-dot ${controllerConnected ? "online" : "waiting"}`}
            />
            {controllerConnected
              ? "Controller active"
              : "Waiting for controller"}
          </div>
          <div className="status-row">
            <span className={`status-dot ${simReady ? "online" : "waiting"}`} />
            {simReady ? "Simulation ready" : "Loading sim…"}
          </div>
          <div className="camera-toggle">
            <button
              type="button"
              className={cameraMode === "third" ? "active" : ""}
              onClick={() => setCameraMode("third")}
            >
              3rd person
            </button>
            <button
              type="button"
              className={cameraMode === "first" ? "active" : ""}
              onClick={() => setCameraMode("first")}
            >
              1st person
            </button>
          </div>
          {controllerConnected && (
            <div className="input-debug">
              <span className="input-debug-label">Input</span>
              <span>
                joy {liveInput.coarseX.toFixed(2)}, {liveInput.coarseY.toFixed(2)}
              </span>
              <span>
                tilt {liveInput.fineP.toFixed(2)}, {liveInput.fineR.toFixed(2)}
              </span>
              <span>
                walk {walkSpeedKmh.toFixed(2)} km/h (max {MAX_WALK_SPEED_KMH})
              </span>
            </div>
          )}
        </div>

        <div className="hud-panel hud-top-right">
          {roomId && (
            <div className="qr-section">
              <QRCode url={controllerUrl} size={140} />
              <p className="qr-label">Scan to connect phone</p>
              <p className="room-id">Room: {roomId}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
