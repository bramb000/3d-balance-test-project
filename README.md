# Multi-Limb Balance Robot

A pure-web exploration of dual-input robot control: **touch for coarse movement**, **phone tilt for fine balance correction** — similar to Switch motion aiming.

Physics powered by **[MuJoCo](https://mujoco.org/)** (official WASM bindings) — procedural N-leg robots with native heightfield terrain and proper contact dynamics.

## Architecture

- **Desktop** (`/`): MuJoCo simulation + Three.js rendering, QR code for pairing
- **Mobile** (`/controller/:roomId`): Virtual joystick + gyroscope controller
- **Server** (port 3001): WebSocket relay between display and controller

## Quick Start

```bash
npm install
npm run dev
```

Open **http://localhost:5173** on desktop. First load downloads ~10MB MuJoCo WASM. Scan the QR code with your phone (same Wi‑Fi network).

**Live demo:** https://threed-balance-test-project.onrender.com

## Local Network Testing

Mobile must reach your desktop over LAN — `localhost` won't work on a phone.

1. Find your desktop LAN IP (e.g. `192.168.1.42`)
2. Open `http://192.168.1.42:5173` on desktop
3. Scan the QR code — it encodes your LAN IP automatically
4. WebSocket connects to port **3001** on the same host

## iOS Gyroscope (HTTPS)

`DeviceOrientation` requires a secure context on iOS. Options:

- **Android**: Works over HTTP on LAN
- **iOS**: Use HTTPS locally:
  ```bash
  npm run dev -w client -- --https
  ```
  Accept the self-signed certificate on both devices, then scan the QR code

## Controls

| Input | Role | Effect |
|-------|------|--------|
| Virtual joystick | Coarse | Horizontal force on robot torso |
| Phone tilt | Fine | Corrective torque for balance |
| Calibrate button | — | Sets current phone orientation as neutral |

## Leg Configuration

Use the leg picker on desktop: presets **3**, **4**, **6**, or enter a custom count (2–12). Changing legs regenerates the MJCF model and reloads the simulation.

## Tuning

Edit [`client/src/config/controls.ts`](client/src/config/controls.ts):

- `COARSE_FORCE` — joystick force on torso
- `FINE_TORQUE` — gyro correction torque
- `GYRO_SMOOTHING` — low-pass filter on tilt input (mobile)

Robot morphology is defined in [`client/src/mujoco/generateMjcf.ts`](client/src/mujoco/generateMjcf.ts).

## Production Build

```bash
npm run build
npm start
```

Serves the built client (including MuJoCo WASM) and WebSocket server on port 3001.

## Credits

- [MuJoCo](https://mujoco.org/) by Google DeepMind (Apache 2.0)
