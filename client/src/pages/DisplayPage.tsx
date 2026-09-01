import { useEffect, useRef, useState } from "react";
import type { ControlPacket } from "@balance/shared";
import { DisplayScene } from "../scene/DisplayScene";
import { QRCode } from "../components/QRCode";
import { LegCountPicker } from "../components/LegCountPicker";
import { useWebSocket } from "../hooks/useWebSocket";
import { useMujoco } from "../mujoco/useMujoco";
import type { CameraMode } from "../config/controls";
import { MAX_WALK_SPEED_KMH } from "../config/controls";
import { getWalkSpeedMps } from "../physics/applyControls";
import "../styles/display.css";

const defaultControl: ControlPacket = {
  t: 0,
  coarse: { x: 0, y: 0 },
  fine: { pitch: 0, roll: 0 },
};

export function DisplayPage() {
  const [legCount, setLegCount] = useState(4);
  const [tilt, setTilt] = useState(0);
  const [cameraMode, setCameraMode] = useState<CameraMode>("third");
  const [liveInput, setLiveInput] = useState({
    coarseX: 0,
    coarseY: 0,
    fineP: 0,
    fineR: 0,
  });
  const controlRef = useRef<ControlPacket>(defaultControl);
  const { simState, loading, error, ready } = useMujoco(legCount);
  const { connected, roomId, controllerConnected, onControl } =
    useWebSocket("display");

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
    getWalkSpeedMps({
      x: liveInput.coarseX,
      y: liveInput.coarseY,
    }) *
    3.6;

  const tiltColor =
    tilt < 15 ? "#22c55e" : tilt < 30 ? "#eab308" : "#ef4444";

  return (
    <div className="display-page">
      {ready && simState && (
        <DisplayScene
          simState={simState}
          cameraMode={cameraMode}
          onTiltChange={setTilt}
          controlRef={controlRef}
        />
      )}

      {(loading || error) && (
        <div className="loading-overlay">
          {error ? (
            <>
              <p className="loading-error">Simulation error</p>
              <p className="loading-detail">{error}</p>
            </>
          ) : (
            <>
              <div className="loading-spinner" />
              <p className="loading-text">Loading MuJoCo physics…</p>
              <p className="loading-detail">First load may take a few seconds</p>
            </>
          )}
        </div>
      )}

      <div className="hud-overlay">
        <div className="hud-panel hud-top-left">
          <h1>Balance Robot</h1>
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
            <span className={`status-dot ${ready ? "online" : "waiting"}`} />
            {ready ? "MuJoCo ready" : "Loading sim…"}
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
          <LegCountPicker legCount={legCount} onChange={setLegCount} />
          {roomId && (
            <div className="qr-section">
              <QRCode url={controllerUrl} size={140} />
              <p className="qr-label">Scan to connect phone</p>
              <p className="room-id">Room: {roomId}</p>
            </div>
          )}
        </div>

        <div className="hud-panel hud-bottom">
          <div className="balance-meter">
            <span className="balance-label">Balance</span>
            <div className="balance-bar-track">
              <div
                className="balance-bar-fill"
                style={{
                  width: `${Math.min(100, (tilt / 45) * 100)}%`,
                  backgroundColor: tiltColor,
                }}
              />
            </div>
            <span className="balance-value" style={{ color: tiltColor }}>
              {tilt.toFixed(1)}°
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
