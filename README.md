# Multi-Limb Balance Robot

A pure-web exploration of dual-input robot control: **touch for coarse movement**, **phone tilt for fine balance correction** — similar to Switch motion aiming.

## Architecture

- **Desktop** (`/`): 3D physics scene with a procedural multi-leg robot on uneven terrain, plus a QR code for pairing
- **Mobile** (`/controller/:roomId`): Virtual joystick + gyroscope controller
- **Server** (port 3001): WebSocket relay between display and controller

## Quick Start

```bash
npm install
npm run dev
```

Open **http://localhost:5173** on desktop. Scan the QR code with your phone (same Wi‑Fi network).

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
| Virtual joystick | Coarse | Horizontal force on robot body |
| Phone tilt | Fine | Corrective torque for balance |
| Calibrate button | — | Sets current phone orientation as neutral |

## Leg Configuration

Use the leg picker on desktop: presets **3**, **4**, **6**, or enter a custom count (2–12). Changing legs rebuilds the robot.

## Tuning

Edit [`client/src/config/controls.ts`](client/src/config/controls.ts):

- `COARSE_FORCE` — joystick impulse strength
- `FINE_TORQUE` — gyro correction strength
- `GYRO_SMOOTHING` — low-pass filter on tilt input

## Production Build

```bash
npm run build
npm start
```

Serves the built client and WebSocket server on port 3001.
