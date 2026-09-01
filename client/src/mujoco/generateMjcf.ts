export const TORSO_BODY = "torso";
export const TERRAIN_GEOM = "ground";

const TERRAIN_HALF = 20;
const TERRAIN_N = 64;
const ATTACH_R = 0.32;
const FOOT_R = 0.82;
const FOOT_SPHERE_R = 0.14;
const TORSO_HALF_H = 0.35;

function heightAt(x: number, y: number): number {
  // Gentler hills — easier to balance while still uneven
  return (
    Math.sin(x * 0.15) * Math.cos(y * 0.12) * 0.9 +
    Math.sin(x * 0.3 + 1.2) * Math.sin(y * 0.25) * 0.45 +
    Math.cos(x * 0.08 - y * 0.1) * 0.25
  );
}

export type HfieldParams = {
  min: number;
  max: number;
  range: number;
  elevation: number;
  base: number;
  data: string;
};

export function buildHfieldParams(): HfieldParams {
  const rows = TERRAIN_N + 1;
  const cols = TERRAIN_N + 1;
  let min = Infinity;
  let max = -Infinity;
  const raw: number[] = [];

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const x = (col / TERRAIN_N - 0.5) * TERRAIN_HALF * 2;
      const y = (row / TERRAIN_N - 0.5) * TERRAIN_HALF * 2;
      const h = heightAt(x, y);
      raw.push(h);
      min = Math.min(min, h);
      max = Math.max(max, h);
    }
  }

  const range = max - min || 1;
  const elevation = range;
  const base = 0.001;
  const normalized = raw.map((h) => ((h - min) / range).toFixed(4));

  return { min, max, range, elevation, base, data: normalized.join(" ") };
}

export function terrainMuJoCoZ(
  x: number,
  y: number,
  params: HfieldParams
): number {
  const h = heightAt(x, y);
  const norm = (h - params.min) / params.range;
  return norm * params.elevation + params.base;
}

/** Rigid strut legs welded to torso — won't collapse like hinged chains */
function buildRigidLeg(
  legIndex: number,
  angle: number,
  hfield: HfieldParams,
  spawnZ: number
): string {
  const ax = Math.cos(angle) * ATTACH_R;
  const ay = Math.sin(angle) * ATTACH_R;
  const az = -TORSO_HALF_H;
  const fx = Math.cos(angle) * FOOT_R;
  const fy = Math.sin(angle) * FOOT_R;
  const footWorldZ = terrainMuJoCoZ(fx, fy, hfield);
  const fz = footWorldZ - spawnZ + FOOT_SPHERE_R;

  const fmt = (n: number) => n.toFixed(4);

  return `
      <geom name="leg${legIndex}_strut" type="capsule"
            fromto="${fmt(ax)} ${fmt(ay)} ${fmt(az)} ${fmt(fx)} ${fmt(fy)} ${fmt(fz)}"
            size="0.07" rgba="0.42 0.45 0.5 1"/>
      <geom name="leg${legIndex}_foot" type="sphere" size="${FOOT_SPHERE_R}"
            pos="${fmt(fx)} ${fmt(fy)} ${fmt(fz)}" mass="0.5"
            friction="1.8 0.005 0.0001" condim="4" rgba="0.22 0.25 0.28 1"/>`;
}

function computeSpawnZ(legCount: number, hfield: HfieldParams): number {
  let maxFootZ = hfield.base;
  for (let i = 0; i < legCount; i++) {
    const angle = (i / legCount) * Math.PI * 2;
    const fx = Math.cos(angle) * FOOT_R;
    const fy = Math.sin(angle) * FOOT_R;
    maxFootZ = Math.max(maxFootZ, terrainMuJoCoZ(fx, fy, hfield));
  }
  // Body center height: highest foot + leg clearance + torso half-height
  return maxFootZ + 0.55 + TORSO_HALF_H + FOOT_SPHERE_R;
}

export function generateMjcf(legCount: number): string {
  const legs = Math.max(2, Math.min(12, legCount));
  const hfield = buildHfieldParams();
  const spawnZ = computeSpawnZ(legs, hfield);
  const legXml = Array.from({ length: legs }, (_, i) =>
    buildRigidLeg(i, (i / legs) * Math.PI * 2, hfield, spawnZ)
  ).join("\n");

  return `<mujoco model="balance_robot">
  <compiler angle="degree" inertiafromgeom="true"/>
  <option timestep="0.002" gravity="0 0 -9.81" integrator="implicitfast"
          cone="elliptic" impratio="10" noslip_iterations="3"/>

  <default>
    <geom solref="0.02 1" solimp="0.9 0.95 0.001" friction="1.2 0.005 0.0001" condim="3"/>
  </default>

  <asset>
    <hfield name="terrain" nrow="${TERRAIN_N + 1}" ncol="${TERRAIN_N + 1}"
            size="${TERRAIN_HALF} ${TERRAIN_HALF} ${hfield.elevation.toFixed(3)} ${hfield.base.toFixed(3)}">
      ${hfield.data}
    </hfield>
  </asset>

  <worldbody>
    <light pos="5 -5 12" dir="-0.3 0.3 -1" diffuse="0.8 0.8 0.8"/>
    <light pos="-5 5 8" dir="0.3 -0.3 -1" diffuse="0.4 0.4 0.5"/>
    <geom name="${TERRAIN_GEOM}" type="hfield" hfield="terrain" rgba="0.23 0.35 0.25 1" condim="3"/>
    <geom name="safety_floor" type="box" size="50 50 1" pos="0 0 -2"
          rgba="0.15 0.2 0.15 0" contype="1" conaffinity="1"/>

    <body name="${TORSO_BODY}" pos="0 0 ${spawnZ.toFixed(3)}">
      <freejoint name="root"/>
      <geom name="torso_geom" type="capsule" size="0.38 0.32" rgba="0.39 0.4 0.95 1" mass="3"/>
      ${legXml}
    </body>
  </worldbody>
</mujoco>`;
}

export function getTerrainHeightAt(x: number, y: number): number {
  return heightAt(x, y);
}

export { buildHfieldParams as getHfieldParams };
