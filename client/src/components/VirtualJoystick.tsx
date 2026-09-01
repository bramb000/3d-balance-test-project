import { useRef, useState } from "react";
import type { JoystickState } from "../hooks/useVirtualJoystick";

type Props = {
  onUpdate: (state: JoystickState) => void;
};

export function VirtualJoystick({ onUpdate }: Props) {
  const zoneRef = useRef<HTMLDivElement>(null);
  const [stickPos, setStickPos] = useState({ x: 0, y: 0 });
  const activeRef = useRef(false);
  const centerRef = useRef({ x: 0, y: 0 });
  const touchIdRef = useRef<number | null>(null);

  const updateStick = (clientX: number, clientY: number) => {
    const dx = clientX - centerRef.current.x;
    const dy = clientY - centerRef.current.y;
    const maxRadius = 60;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const clampedDist = Math.min(dist, maxRadius);
    const angle = Math.atan2(dy, dx);

    const state = {
      x: (Math.cos(angle) * clampedDist) / maxRadius,
      y: -(Math.sin(angle) * clampedDist) / maxRadius,
    };

    setStickPos({
      x: Math.cos(angle) * Math.min(dist, 50),
      y: Math.sin(angle) * Math.min(dist, 50),
    });
    onUpdate(state);
  };

  const handleStart = (clientX: number, clientY: number, touchId?: number) => {
    activeRef.current = true;
    centerRef.current = { x: clientX, y: clientY };
    touchIdRef.current = touchId ?? null;
    setStickPos({ x: 0, y: 0 });
    onUpdate({ x: 0, y: 0 });
  };

  const handleMove = (clientX: number, clientY: number, touchId?: number) => {
    if (!activeRef.current) return;
    if (touchIdRef.current !== null && touchId !== touchIdRef.current) return;
    updateStick(clientX, clientY);
  };

  const handleEnd = (touchId?: number) => {
    if (touchIdRef.current !== null && touchId !== touchIdRef.current) return;
    activeRef.current = false;
    touchIdRef.current = null;
    setStickPos({ x: 0, y: 0 });
    onUpdate({ x: 0, y: 0 });
  };

  return (
    <div
      ref={zoneRef}
      className="joystick-zone"
      onTouchStart={(e) => {
        e.preventDefault();
        const t = e.changedTouches[0];
        handleStart(t.clientX, t.clientY, t.identifier);
      }}
      onTouchMove={(e) => {
        e.preventDefault();
        const t = e.changedTouches[0];
        handleMove(t.clientX, t.clientY, t.identifier);
      }}
      onTouchEnd={(e) => {
        e.preventDefault();
        const t = e.changedTouches[0];
        handleEnd(t.identifier);
      }}
      onMouseDown={(e) => handleStart(e.clientX, e.clientY)}
      onMouseMove={(e) => {
        if (e.buttons === 1) handleMove(e.clientX, e.clientY);
      }}
      onMouseUp={() => handleEnd()}
      onMouseLeave={() => handleEnd()}
    >
      <div className="joystick-base" />
      <div
        className="joystick-stick"
        style={{ transform: `translate(calc(-50% + ${stickPos.x}px), calc(-50% + ${stickPos.y}px))` }}
      />
    </div>
  );
}
