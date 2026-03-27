# DroneNav v4.0 — Ground Control Station

## Files
- `bridge.js`   — Node.js relay between ESP32 WiFi and browser dashboard
- `index.html`  — Browser dashboard (open directly, no server needed)
- `package.json`— Node.js dependencies

---

## Setup (do once)

### 1. Install Node.js
Download from https://nodejs.org (LTS version)

### 2. Install bridge dependencies
Open terminal/command prompt in this folder:
```
npm install
```

---

## Every flight — exact sequence

### Step 1 — Flash ESP32
- Board: AI Thinker ESP32-CAM
- Partition: Huge APP (3MB No OTA)
- File: esp32_nav_v4_fixed.ino

### Step 2 — Connect laptop WiFi
- Network: `DroneNav-AP`
- Password: `drone1234`
- Your laptop must be on this network (not your home WiFi)

### Step 3 — Run bridge
```
node bridge.js
```
You will see:
```
Bridge running. Connect dashboard to ws://localhost:8765
```

### Step 4 — Open dashboard
Open `index.html` in Chrome or Firefox (double-click the file).
Status pill turns GREEN when ESP32 is reachable.

### Step 5 — Start mission
1. Right-click start point on Google Maps → copy coordinates
2. Paste into Start Lat / Start Lon fields
3. Right-click destination → paste into Dest Lat / Dest Lon
4. Set altitude (3–5m recommended for first flights)
5. Click **Launch Mission**

---

## During flight
- Dashboard updates every 200ms automatically
- **Return Home** button → drone flies back to takeoff point
- **ABORT** button → drone lands immediately at current position
- Keep browser tab open — closing it stops heartbeat → drone RTH in 5s

---

## Dashboard panels
| Panel | What it shows |
|---|---|
| Flight State | Status, altitude, velocity, heading compass |
| Battery | Voltage, percentage, low/critical warnings |
| Sensor Trust | Live trust scores for IMU/Baro/Mag/Flow/LiDAR |
| Situational Awareness | Active alerts as colored pills |
| Wind + Vibration | Wind speed/direction, IMU noise RMS bars |
| LiDAR | Obstacle distance, red when blocked |
| Map | Top-down flight path, waypoints, drone position |
| Mission Control | Coordinate input, Launch/RTH/Abort buttons |
| Telemetry Log | Scrolling log, CSV export |

---

## Troubleshooting

| Problem | Fix |
|---|---|
| Status shows DISCONNECTED | Run `node bridge.js` first |
| Status shows BRIDGE ONLY | ESP32 not powered or WiFi not connected |
| Cannot install packages | Run `npm install` in this folder |
| Map is empty | Wait for first telemetry packet after mission start |
| Launch button disabled | Drone state is not IDLE — check ESP32 serial output |
