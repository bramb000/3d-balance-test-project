import { useCallback, useRef } from "react";

export type JoystickState = { x: number; y: number };

export function useVirtualJoystick() {
  const stateRef = useRef<JoystickState>({ x: 0, y: 0 });
  const activeRef = useRef(false);
  const centerRef = useRef({ x: 0, y: 0 });
  const touchIdRef = useRef<number | null>(null);

  const getState = useCallback((): JoystickState => {
    return { ...stateRef.current };
  }, []);

  const handleStart = useCallback(
    (clientX: number, clientY: number, touchId?: number) => {
      activeRef.current = true;
      centerRef.current = { x: clientX, y: clientY };
      touchIdRef.current = touchId ?? null;
      stateRef.current = { x: 0, y: 0 };
    },
    []
  );

  const handleMove = useCallback(
    (clientX: number, clientY: number, touchId?: number) => {
      if (!activeRef.current) return;
      if (touchIdRef.current !== null && touchId !== touchIdRef.current) return;

      const dx = clientX - centerRef.current.x;
      const dy = clientY - centerRef.current.y;
      const maxRadius = 60;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const clampedDist = Math.min(dist, maxRadius);
      const angle = Math.atan2(dy, dx);

      stateRef.current = {
        x: (Math.cos(angle) * clampedDist) / maxRadius,
        y: -(Math.sin(angle) * clampedDist) / maxRadius,
      };
    },
    []
  );

  const handleEnd = useCallback((touchId?: number) => {
    if (touchIdRef.current !== null && touchId !== touchIdRef.current) return;
    activeRef.current = false;
    touchIdRef.current = null;
    stateRef.current = { x: 0, y: 0 };
  }, []);

  return { getState, handleStart, handleMove, handleEnd };
}
