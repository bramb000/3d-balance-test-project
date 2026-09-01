/** Two-link IK in a vertical plane; hip at origin, leg extends along local -Z at zero angles. */
export function solveLegIk(
  targetX: number,
  targetZ: number,
  L1: number,
  L2: number
): { hip: number; knee: number } | null {
  const d = Math.hypot(targetX, targetZ);
  if (d > L1 + L2 - 1e-4 || d < Math.abs(L1 - L2) + 1e-4) return null;

  const cosKnee = (L1 * L1 + L2 * L2 - d * d) / (2 * L1 * L2);
  const knee = -(Math.acos(Math.max(-1, Math.min(1, cosKnee))) - Math.PI);
  const hip =
    Math.atan2(targetX, -targetZ) -
    Math.atan2(L2 * Math.sin(-knee), L1 + L2 * Math.cos(-knee));

  return { hip, knee };
}
