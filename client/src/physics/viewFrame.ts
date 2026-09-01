/** Camera horizontal basis vectors in MuJoCo world coords (Z-up, XY ground). */
export type ViewFrame = {
  forward: [number, number];
  right: [number, number];
};

let viewFrame: ViewFrame = {
  forward: [0, 1],
  right: [1, 0],
};

export function setViewFrame(forward: [number, number], right: [number, number]): void {
  viewFrame = { forward, right };
}

export function getViewFrame(): ViewFrame {
  return viewFrame;
}

/** Three.js Y-up horizontal forward/right → MuJoCo XY. */
export function threeBasisToMuJoCo(
  forwardThree: { x: number; z: number },
  rightThree: { x: number; z: number }
): ViewFrame {
  return {
    forward: [forwardThree.x, -forwardThree.z],
    right: [rightThree.x, -rightThree.z],
  };
}
