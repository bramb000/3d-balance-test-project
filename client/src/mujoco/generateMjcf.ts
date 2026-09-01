export const TORSO_BODY = "torso";
export const TERRAIN_GEOM = "ground";

const TERRAIN_HALF = 20;
const TERRAIN_N = 64;

function heightAt(x: number, y: number): number {
  return (
    Math.sin(x * 0.15) * Math.cos(y * 0.12) * 1.5 +
    Math.sin(x * 0.3 + 1.2) * Math.sin(y * 0.25) * 0.8 +
    Math.cos(x * 0.08 - y * 0.1) * 0.5
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
  // MuJoCo requires all hfield size components to be positive.
  // Heights are normalized 0→1; elevation scales to world range; base is z of minimum.
  const elevation = range;
  const base = 0.001;
  const normalized = raw.map((h) => ((h - min) / range).toFixed(4));

  return {
    min,
    max,
    range,
    elevation,
    base,
    data: normalized.join(" "),
  };
}

/** MuJoCo world Z of terrain at (x, y) given hfield params */
export function terrainMuJoCoZ(
  x: number,
  y: number,
  params: HfieldParams
): number {
  const h = heightAt(x, y);
  const norm = (h - params.min) / params.range;
  return norm * params.elevation + params.base;
}

function buildLeg(legIndex: number, angle: number): string {
  const attachR = 0.45;
  const ax = (Math.cos(angle) * attachR).toFixed(4);
  const ay = (Math.sin(angle) * attachR).toFixed(4);
  const prefix = `leg${legIndex}`;

  return `
    <body name="${prefix}_upper" pos="${ax} ${ay} -0.35">
      <joint name="${prefix}_hip" type="hinge" axis="0 1 0" range="-70 70" damping="3"/>
      <geom name="${prefix}_upper_geom" type="capsule" fromto="0 0 0 0 0 -0.55" size="0.06" rgba="0.42 0.45 0.5 1"/>
      <body name="${prefix}_lower" pos="0 0 -0.55">
        <joint name="${prefix}_knee" type="hinge" axis="0 1 0" range="-100 15" damping="2"/>
        <geom name="${prefix}_lower_geom" type="capsule" fromto="0 0 0 0 0 -0.55" size="0.05" rgba="0.3 0.34 0.38 1"/>
        <geom name="${prefix}_foot" type="sphere" size="0.12" pos="0 0 -0.55" rgba="0.22 0.25 0.28 1" friction="1.5 0.005 0.0001" condim="4"/>
      </body>
    </body>`;
}

export function generateMjcf(legCount: number): string {
  const legs = Math.max(2, Math.min(12, legCount));
  const hfield = buildHfieldParams();
  const legXml = Array.from({ length: legs }, (_, i) =>
    buildLeg(i, (i / legs) * Math.PI * 2)
  ).join("\n");

  const spawnZ = terrainMuJoCoZ(0, 0, hfield) + 2.8;

  return `<mujoco model="balance_robot">
  <compiler angle="degree" inertiafromgeom="true"/>
  <option timestep="0.002" gravity="0 0 -9.81" integrator="implicitfast"
          cone="elliptic" impratio="10" noslip_iterations="2"/>

  <default>
    <joint limited="true" armature="0.03"/>
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
      <geom name="torso_geom" type="capsule" size="0.45 0.35" rgba="0.39 0.4 0.95 1" mass="4"/>
      ${legXml}
    </body>
  </worldbody>
</mujoco>`;
}

export function getTerrainHeightAt(x: number, y: number): number {
  return heightAt(x, y);
}

export { buildHfieldParams as getHfieldParams };
