export const TORSO_BODY = "torso";
export const TERRAIN_GEOM = "ground";

export const FEMUR_LEN = 0.38;
export const TIBIA_LEN = 0.38;
export const ATTACH_R = 0.28;
export const FOOT_R = 0.72;
export const FOOT_SPHERE_R = 0.13;
export const TORSO_HALF_H = 0.35;

const TERRAIN_HALF = 20;
const TERRAIN_N = 64;

function heightAt(x: number, y: number): number {
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

function fmt(n: number): string {
  return n.toFixed(4);
}

function buildArticulatedLeg(
  legIndex: number,
  angle: number,
  hfield: HfieldParams,
  spawnZ: number
): { xml: string; hipRest: number; kneeRest: number } {
  const ax = Math.cos(angle) * ATTACH_R;
  const ay = Math.sin(angle) * ATTACH_R;
  const az = -TORSO_HALF_H;
  const axis = `${fmt(-Math.sin(angle))} ${fmt(Math.cos(angle))} 0`;

  const footX = Math.cos(angle) * FOOT_R;
  const footY = Math.sin(angle) * FOOT_R;
  const footWorldZ = terrainMuJoCoZ(footX, footY, hfield) + FOOT_SPHERE_R;

  const dx = footX - ax;
  const dy = footY - ay;
  const radial = Math.hypot(dx, dy);
  const drop = spawnZ + az - footWorldZ;

  const cosKnee =
    (FEMUR_LEN ** 2 + TIBIA_LEN ** 2 - radial ** 2 - drop ** 2) /
    (2 * FEMUR_LEN * TIBIA_LEN);
  const kneeRest = -(Math.acos(Math.max(-1, Math.min(1, cosKnee))) - Math.PI);
  const hipRest =
    Math.atan2(radial, drop) -
    Math.atan2(
      TIBIA_LEN * Math.sin(-kneeRest),
      FEMUR_LEN + TIBIA_LEN * Math.cos(-kneeRest)
    );

  const xml = `
      <body name="hip${legIndex}" pos="${fmt(ax)} ${fmt(ay)} ${fmt(az)}">
        <joint name="hip${legIndex}" type="hinge" axis="${axis}" range="-35 85" damping="1.2" armature="0.02"/>
        <geom name="femur${legIndex}" type="capsule" fromto="0 0 0 0 0 ${fmt(-FEMUR_LEN)}"
              size="0.065" rgba="0.42 0.45 0.5 1" mass="0.45"/>
        <body name="knee${legIndex}" pos="0 0 ${fmt(-FEMUR_LEN)}">
          <joint name="knee${legIndex}" type="hinge" axis="${axis}" range="-115 10" damping="0.9" armature="0.015"/>
          <geom name="tibia${legIndex}" type="capsule" fromto="0 0 0 0 0 ${fmt(-TIBIA_LEN)}"
                size="0.055" rgba="0.35 0.38 0.42 1" mass="0.35"/>
          <body name="foot${legIndex}" pos="0 0 ${fmt(-TIBIA_LEN)}">
            <geom name="foot${legIndex}_geom" type="sphere" size="${FOOT_SPHERE_R}"
                  mass="0.25" friction="1.9 0.005 0.0001" condim="4"
                  rgba="0.22 0.25 0.28 1"/>
          </body>
        </body>
      </body>`;

  return { xml, hipRest, kneeRest };
}

function computeSpawnZ(legCount: number, hfield: HfieldParams): number {
  let maxFootZ = hfield.base;
  for (let i = 0; i < legCount; i++) {
    const angle = (i / legCount) * Math.PI * 2;
    const fx = Math.cos(angle) * FOOT_R;
    const fy = Math.sin(angle) * FOOT_R;
    maxFootZ = Math.max(
      maxFootZ,
      terrainMuJoCoZ(fx, fy, hfield) + FOOT_SPHERE_R
    );
  }
  return maxFootZ + FEMUR_LEN + TIBIA_LEN * 0.55 + TORSO_HALF_H;
}

export function generateMjcf(legCount: number): string {
  const legs = Math.max(2, Math.min(12, legCount));
  const hfield = buildHfieldParams();
  const spawnZ = computeSpawnZ(legs, hfield);

  const legParts: string[] = [];
  const actuators: string[] = [];
  const keyQpos: string[] = [`0 0 ${fmt(spawnZ)}`, "1 0 0 0"];

  for (let i = 0; i < legs; i++) {
    const angle = (i / legs) * Math.PI * 2;
    const { xml, hipRest, kneeRest } = buildArticulatedLeg(
      i,
      angle,
      hfield,
      spawnZ
    );
    legParts.push(xml);
    actuators.push(
      `    <position name="hip${i}_act" joint="hip${i}" kp="140" kv="12" forcerange="-55 55"/>`,
      `    <position name="knee${i}_act" joint="knee${i}" kp="120" kv="10" forcerange="-45 45"/>`
    );
    keyQpos.push(fmt(hipRest), fmt(kneeRest));
  }

  return `<mujoco model="balance_robot">
  <compiler angle="radian" inertiafromgeom="true"/>
  <option timestep="0.002" gravity="0 0 -9.81" integrator="implicitfast"
          cone="elliptic" impratio="10" noslip_iterations="4"/>

  <default>
    <geom solref="0.015 1" solimp="0.92 0.96 0.001" friction="1.3 0.005 0.0001" condim="3"/>
    <joint limited="true"/>
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

    <body name="${TORSO_BODY}" pos="0 0 ${fmt(spawnZ)}">
      <freejoint name="root"/>
      <geom name="torso_geom" type="capsule" size="0.36 0.30" rgba="0.39 0.4 0.95 1" mass="3.2"/>
      <site name="head" pos="0 0 0.42" size="0.04" rgba="1 0.3 0.3 0.6"/>
      ${legParts.join("\n")}
    </body>
  </worldbody>

  <actuator>
${actuators.join("\n")}
  </actuator>

  <keyframe>
    <key name="stand" qpos="${keyQpos.join(" ")}" ctrl="${keyQpos.slice(4).join(" ")}"/>
  </keyframe>
</mujoco>`;
}

export function getTerrainHeightAt(x: number, y: number): number {
  return heightAt(x, y);
}

export { buildHfieldParams as getHfieldParams };
