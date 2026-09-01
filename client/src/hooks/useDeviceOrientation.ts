import { useCallback, useEffect, useRef, useState } from "react";

type Orientation = {
  pitch: number;
  roll: number;
};

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

export function useDeviceOrientation() {
  const [enabled, setEnabled] = useState(false);
  const [needsPermission, setNeedsPermission] = useState(false);
  const neutralRef = useRef<Orientation>({ pitch: 0, roll: 0 });
  const currentRef = useRef<Orientation>({ pitch: 0, roll: 0 });
  const smoothedRef = useRef<Orientation>({ pitch: 0, roll: 0 });

  useEffect(() => {
    const reqPerm = (
      DeviceOrientationEvent as unknown as {
        requestPermission?: () => Promise<string>;
      }
    ).requestPermission;
    setNeedsPermission(typeof reqPerm === "function");
  }, []);

  const handleOrientation = useCallback((event: DeviceOrientationEvent) => {
    const beta = event.beta ?? 0;
    const gamma = event.gamma ?? 0;
    currentRef.current = {
      pitch: toRad(beta),
      roll: toRad(gamma),
    };
  }, []);

  const requestPermission = useCallback(async () => {
    const reqPerm = (
      DeviceOrientationEvent as unknown as {
        requestPermission?: () => Promise<string>;
      }
    ).requestPermission;

    if (reqPerm) {
      const result = await reqPerm();
      if (result !== "granted") return false;
    }

    window.addEventListener("deviceorientation", handleOrientation);
    setEnabled(true);
    return true;
  }, [handleOrientation]);

  const calibrate = useCallback(() => {
    neutralRef.current = { ...currentRef.current };
  }, []);

  const getFineInput = useCallback((): Orientation => {
    const raw = {
      pitch: currentRef.current.pitch - neutralRef.current.pitch,
      roll: currentRef.current.roll - neutralRef.current.roll,
    };

    const smoothing = 0.15;
    smoothedRef.current = {
      pitch:
        smoothedRef.current.pitch +
        (raw.pitch - smoothedRef.current.pitch) * smoothing,
      roll:
        smoothedRef.current.roll +
        (raw.roll - smoothedRef.current.roll) * smoothing,
    };

    return { ...smoothedRef.current };
  }, []);

  useEffect(() => {
    if (!enabled || needsPermission) return;
    window.addEventListener("deviceorientation", handleOrientation);
    return () => {
      window.removeEventListener("deviceorientation", handleOrientation);
    };
  }, [enabled, needsPermission, handleOrientation]);

  return {
    enabled,
    needsPermission,
    requestPermission,
    calibrate,
    getFineInput,
  };
}
