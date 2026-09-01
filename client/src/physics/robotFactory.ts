import {
  BODY_HEIGHT,
  UPPER_LEG_LENGTH,
  LOWER_LEG_LENGTH,
  LEG_ATTACH_RADIUS,
} from "../config/controls";
import { getTerrainHeight } from "./terrain";

export function getLegAngles(legCount: number): number[] {
  return Array.from(
    { length: legCount },
    (_, i) => (i / legCount) * Math.PI * 2
  );
}

export function getRobotSpawnPosition(): [number, number, number] {
  const y =
    getTerrainHeight(0, 0) +
    BODY_HEIGHT +
    UPPER_LEG_LENGTH +
    LOWER_LEG_LENGTH +
    0.5;
  return [0, y, 0];
}

export function getLegAttachPoint(angle: number): { x: number; z: number } {
  return {
    x: Math.cos(angle) * LEG_ATTACH_RADIUS,
    z: Math.sin(angle) * LEG_ATTACH_RADIUS,
  };
}
