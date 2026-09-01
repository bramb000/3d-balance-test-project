import { buildHfieldParams, terrainMuJoCoZ } from "../mujoco/generateMjcf";

let hfield = buildHfieldParams();

export function getTerrainParams() {
  return hfield;
}

export function sampleTerrainHeight(x: number, y: number): number {
  return terrainMuJoCoZ(x, y);
}

export function sampleTerrainHeightUnderBody(
  x: number,
  y: number,
  _radius: number
): number {
  return sampleTerrainHeight(x, y);
}
