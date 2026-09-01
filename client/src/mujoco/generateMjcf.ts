export const TORSO_BODY = "torso";
export const MOCAP_BODY = "mocap";
export const TERRAIN_GEOM = "ground";

export const FEMUR_LEN = 0.38;
export const TIBIA_LEN = 0.38;
export const ATTACH_R = 0.28;
export const FOOT_R = 0.72;
export const FOOT_SPHERE_R = 0.13;
export const TORSO_HALF_H = 0.35;
export const BODY_CLEARANCE = 0.55;

const TERRAIN_HALF = 20;

function fmt(n: number): string {
  return n.toFixed(4);
}

function buildArticulatedLeg(legIndex: number, angle: number): string {
  const ax = Math.cos(angle) * ATTACH_R;
  const ay = Math.sin(angle) * ATTACH_R;
  const az = -TORSO_HALF_H;
  const axis = `${fmt(-Math.sin(angle))} ${fmt(Math.cos(angle))} 0`;

  return `
      <body name="hip${legIndex}" pos="${fmt(ax)} ${fmt(ay)} ${fmt(az)}">
        <joint name="hip${legIndex}" type="hinge" axis="${axis}" range="-20 70" damping="2.5" armature="0.04"/>
        <geom name="femur${legIndex}" type="capsule" fromto="0 0 0 0 0 ${fmt(-FEMUR_LEN)}"
              size="0.065" rgba="0.42 0.45 0.5 1" mass="0.35"/>
        <body name="knee${legIndex}" pos="0 0 ${fmt(-FEMUR_LEN)}">
          <joint name="knee${legIndex}" type="hinge" axis="${axis}" range="-95 5" damping="2" armature="0.03"/>
          <geom name="tibia${legIndex}" type="capsule" fromto="0 0 0 0 0 ${fmt(-TIBIA_LEN)}"
                size="0.055" rgba="0.35 0.38 0.42 1" mass="0.28"/>
          <body name="foot${legIndex}" pos="0 0 ${fmt(-TIBIA_LEN)}">
            <geom name="foot${legIndex}_geom" type="sphere" size="${FOOT_SPHERE_R}"
                  mass="0.18" friction="1.6 0.005 0.0001" condim="4"
                  rgba="0.22 0.25 0.28 1"/>
          </body>
        </body>
      </body>`;
}

/** Flat floor + mocap-driven torso — stable base for procedural walking. */
export function generateMjcf(legCount: number): string {
  const legs = Math.max(2, Math.min(12, legCount));
  const spawnZ = 1.05;
  const legParts: string[] = [];
  const actuators: string[] = [];
  const keyQpos: string[] = [`0 0 ${fmt(spawnZ - 0.1)}`, "1 0 0 0"];

  for (let i = 0; i < legs; i++) {
    const angle = (i / legs) * Math.PI * 2;
    legParts.push(buildArticulatedLeg(i, angle));
    actuators.push(
      `    <position name="hip${i}_act" joint="hip${i}" kp="55" kv="6" forcerange="-25 25"/>`,
      `    <position name="knee${i}_act" joint="knee${i}" kp="45" kv="5" forcerange="-20 20"/>`
    );
    keyQpos.push("0.45", "-0.95");
  }

  return `<mujoco model="balance_robot">
  <compiler angle="radian" inertiafromgeom="true"/>
  <option timestep="0.005" gravity="0 0 -9.81" integrator="implicitfast"
          cone="elliptic" impratio="5"/>

  <default>
    <geom solref="0.02 1" solimp="0.9 0.95 0.001" friction="1.2 0.005 0.0001" condim="3"/>
    <joint limited="true"/>
  </default>

  <worldbody>
    <light pos="5 -5 12" dir="-0.3 0.3 -1" diffuse="0.8 0.8 0.8"/>
    <light pos="-5 5 8" dir="0.3 -0.3 -1" diffuse="0.4 0.4 0.5"/>
    <geom name="${TERRAIN_GEOM}" type="plane" size="${TERRAIN_HALF} ${TERRAIN_HALF} 0.1"
          rgba="0.23 0.35 0.25 1" condim="3"/>

    <body name="${MOCAP_BODY}" mocap="true" pos="0 0 ${fmt(spawnZ)}">
      <geom type="sphere" size="0.01" contype="0" conaffinity="0" rgba="0 0 0 0"/>
    </body>

    <body name="${TORSO_BODY}" pos="0 0 ${fmt(spawnZ - 0.1)}">
      <freejoint name="root"/>
      <geom name="torso_geom" type="capsule" size="0.36 0.30" rgba="0.39 0.4 0.95 1" mass="2.8"/>
      <site name="head" pos="0 0 0.42" size="0.04" rgba="1 0.3 0.3 0.6"/>
      ${legParts.join("\n")}
    </body>
  </worldbody>

  <equality>
    <weld body1="${MOCAP_BODY}" body2="${TORSO_BODY}" solref="0.02 1" solimp="0.95 0.99 0.001"/>
  </equality>

  <actuator>
${actuators.join("\n")}
  </actuator>

  <keyframe>
    <key name="stand" qpos="${keyQpos.join(" ")}" ctrl="${keyQpos.slice(5).join(" ")}"/>
  </keyframe>
</mujoco>`;
}

/** Legacy export — flat plane at z=0. */
export function buildHfieldParams() {
  return { min: 0, max: 0, range: 1, elevation: 0, base: 0, data: "0" };
}

export function terrainMuJoCoZ(_x: number, _y: number): number {
  return 0;
}

export function getTerrainHeightAt(_x: number, _y: number): number {
  return 0;
}

export { buildHfieldParams as getHfieldParams };
