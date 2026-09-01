import { useEffect, useRef, useState } from "react";
import type { ControlPacket } from "@balance/shared";
import { DisplayScene } from "../scene/DisplayScene";
import { QRCode } from "../components/QRCode";
import { LegCountPicker } from "../components/LegCountPicker";
import { useWebSocket } from "../hooks/useWebSocket";
import { useMujoco } from "../mujoco/useMujoco";
import "../styles/display.css";

const defaultControl: ControlPacket = {
  t: 0,
  coarse: { x: 0, y: 0 },
  fine: { pitch: 0, roll: 0 },
};

export function DisplayPage() {
  const [legCount, setLegCount] = useState(4);
  const [tilt, setTilt] = useState(0);
  const controlRef = useRef<ControlPacket>(defaultControl);
  const { simState, loading, error, ready } = useMujoco(legCount);
  const { connected, roomId, controllerConnected, onControl } =
    useWebSocket("display");

  useEffect(() => {
    onControl((msg) => {
      if (msg.type === "control") {
        controlRef.current = msg.data;
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

  const tiltColor =
    tilt < 15 ? "#22c55e" : tilt < 30 ? "#eab308" : "#ef4444";

  return (
    <div className="display-page">
      {ready && simState && (
        <DisplayScene
          simState={simState}
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
