/** Forward speed at full stick — within Go2 policy ±1.0 m/s. */
export const MAX_WALK_SPEED_MPS = 0.8;
export const MAX_WALK_SPEED_KMH = MAX_WALK_SPEED_MPS * 3.6;
/** Lateral speed at full stick — policy max is ±0.5 m/s. */
export const MAX_LAT_VEL_MPS = 0.4;
/** Yaw rate at full tilt / Q-E — policy max is ±1.0 rad/s. */
export const MAX_ANG_VEL = 0.8;
/**
 * Idle forward command after spawn settle. Hard 0 at launch tips these policies;
 * a light crawl matches the demo default (0.5) more safely when the stick is released.
 */
export const IDLE_FORWARD_MPS = 0.25;
/** Ignore stick/gyro below this magnitude. */
export const INPUT_DEADZONE = 0.08;
/** Leave policy UI defaults alone for this long after load. */
export const SETTLE_MS = 1500;
export const STEP_LENGTH = 0.14;
export const STEP_CLEARANCE = 0.05;
export const SWING_DURATION = 0.45;
export const FINE_BALANCE_GAIN = 8;
export const BODY_CLEARANCE = 0.55;
export const GYRO_SMOOTHING = 0.15;

export const LEG_LENGTH = 1.2;
export const BODY_MASS = 4;
export const BODY_RADIUS = 0.5;
export const BODY_HEIGHT = 0.8;
export const UPPER_LEG_LENGTH = 0.6;
export const LOWER_LEG_LENGTH = 0.6;
export const FOOT_RADIUS = 0.15;
export const LEG_ATTACH_RADIUS = 0.45;

export type CameraMode = "third" | "first";
