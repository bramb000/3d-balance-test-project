const TERRAIN_SIZE = 40;
const TERRAIN_SEGMENTS = 64;

function heightAt(x: number, z: number): number {
  return (
    Math.sin(x * 0.15) * Math.cos(z * 0.12) * 1.5 +
    Math.sin(x * 0.3 + 1.2) * Math.sin(z * 0.25) * 0.8 +
    Math.cos(x * 0.08 - z * 0.1) * 0.5
  );
}

export function generateHeightmap(): {
  heights: Float32Array;
  rows: number;
  cols: number;
  scale: { x: number; y: number; z: number };
} {
  const cols = TERRAIN_SEGMENTS + 1;
  const rows = TERRAIN_SEGMENTS + 1;
  const heights = new Float32Array(cols * rows);

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const x = (col / TERRAIN_SEGMENTS - 0.5) * TERRAIN_SIZE;
      const z = (row / TERRAIN_SEGMENTS - 0.5) * TERRAIN_SIZE;
      heights[row * cols + col] = heightAt(x, z);
    }
  }

  return {
    heights,
    rows,
    cols,
    scale: { x: TERRAIN_SIZE, y: 3, z: TERRAIN_SIZE },
  };
}

export function getTerrainHeight(x: number, z: number): number {
  return heightAt(x, z);
}

export { TERRAIN_SIZE, TERRAIN_SEGMENTS };
