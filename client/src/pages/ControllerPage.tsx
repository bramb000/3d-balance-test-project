import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import type { ControlPacket } from "@balance/shared";
import { VirtualJoystick } from "../components/VirtualJoystick";
import { useWebSocket } from "../hooks/useWebSocket";
import { useDeviceOrientation } from "../hooks/useDeviceOrientation";
import type { JoystickState } from "../hooks/useVirtualJoystick";
import "../styles/controller.css";

export function ControllerPage() {
  const { roomId } = useParams<{ roomId: string }>();
  const { connected, send, joinError } = useWebSocket("controller", roomId);
  const { enabled, needsPermission, requestPermission, calibrate, getFineInput } =
    useDeviceOrientation();

  const coarseRef = useRef<JoystickState>({ x: 0, y: 0 });
  const [gyroReady, setGyroReady] = useState(false);

  const handleJoystickUpdate = useCallback((state: JoystickState) => {
    coarseRef.current = state;
  }, []);

  const handleEnableMotion = async () => {
    const ok = await requestPermission();
    if (ok) {
      calibrate();
      setGyroReady(true);
    }
  };

  useEffect(() => {
    if (!connected) return;

    const interval = setInterval(() => {
      const fine = getFineInput();
      const packet: ControlPacket = {
        t: Date.now(),
        coarse: { ...coarseRef.current },
        fine: { pitch: fine.pitch, roll: fine.roll },
      };
      send({ type: "control", data: packet });
    }, 1000 / 60);

    return () => clearInterval(interval);
  }, [connected, send, getFineInput]);

  if (!roomId) {
    return (
      <div className="controller-page">
        <p className="error-text">Invalid room. Scan the QR code on desktop.</p>
      </div>
    );
  }

  return (
    <div className="controller-page">
      <div className="controller-header">
        <h2>Controller</h2>
        <div className="controller-status">
          <span className={`status-dot ${connected ? "online" : ""}`} />
          {joinError
            ? "Room expired"
            : connected
              ? `Room ${roomId}`
              : "Connecting..."}
        </div>
      </div>

      {joinError && (
        <p className="error-text">{joinError}</p>
      )}

      <div className="control-hints">
        <div className="hint">
          <span className="hint-tag coarse">Coarse</span>
          Joystick — walk relative to viewport (1 km/h max)
        </div>
        <div className="hint">
          <span className="hint-tag fine">Fine</span>
          Tilt phone — balance on uneven terrain
        </div>
      </div>

      {!gyroReady && (
        <button className="motion-btn" onClick={handleEnableMotion}>
          {needsPermission ? "Enable Motion Control" : "Start Motion Control"}
        </button>
      )}

      {gyroReady && (
        <button className="calibrate-btn" onClick={calibrate}>
          Calibrate Neutral
        </button>
      )}

      <div className="joystick-area">
        <VirtualJoystick onUpdate={handleJoystickUpdate} />
      </div>

      {enabled && (
        <div className="gyro-indicator">
          <div className="gyro-dot" />
          Motion active
        </div>
      )}
    </div>
  );
}
