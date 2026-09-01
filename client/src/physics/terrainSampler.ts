import {
  buildHfieldParams,
  terrainMuJoCoZ,
  type HfieldParams,
} from "../mujoco/generateMjcf";

let hfield: HfieldParams | null = null;

export function getTerrainParams(): HfieldParams {
  if (!hfield) hfield = buildHfieldParams();
  return hfield;
}

export function sampleTerrainHeight(x: number, y: number): number {
  return terrainMuJoCoZ(x, y, getTerrainParams());
}

export function sampleTerrainNormal(
  x: number,
  y: number,
  eps = 0.08
): [number, number, number] {
  const hx =
    sampleTerrainHeight(x + eps, y) - sampleTerrainHeight(x - eps, y);
  const hy =
    sampleTerrainHeight(x, y + eps) - sampleTerrainHeight(x, y - eps);
  const nx = -hx / (2 * eps);
  const ny = -hy / (2 * eps);
  const nz = 1;
  const len = Math.hypot(nx, ny, nz) || 1;
  return [nx / len, ny / len, nz / len];
}

export function sampleTerrainHeightUnderBody(
  x: number,
  y: number,
  radius: number,
  samples = 6
): number {
  let maxH = sampleTerrainHeight(x, y);
  for (let i = 0; i < samples; i++) {
    const a = (i / samples) * Math.PI * 2;
    const px = x + Math.cos(a) * radius;
    const py = y + Math.sin(a) * radius;
    maxH = Math.max(maxH, sampleTerrainHeight(px, py));
  }
  return maxH;
}
