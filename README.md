# Ethera multiplayer neighborhood

Run `npm install` and `npm run dev`, then open http://localhost:3000.
Enter a name and a room code. Players using the same server and room share the
world, cars, and bikes. Use **Copy invite** to share the room URL. Open two browser
tabs with different names to try it locally. Rooms support up to 12 players.

- WASD / arrow keys: walk; accelerate, reverse, and steer while riding.
- E: interact with the nearest seat, building entrance, or vehicle.
- Benches/chairs: E to sit, then E to stand; one player per seat.
- Homes/hotel: E at the front door to enter. Walk to the green EXIT marker and press E to leave. Players in the same building share its interior.
- Vehicles: E to ride; brake before pressing E to exit.
- Space: brake.
- Leave: leave the room and release your vehicle.

For other devices on your Wi-Fi, run `npm run dev -- --hostname 0.0.0.0` and open
`http://YOUR-LAN-IP:3000` on each device. A localhost invite only works on your own
computer; copy invitations from the LAN address when playing across devices.

## Hosting and state

The custom Node server serves Next.js, HTTP join/leave requests, and the
`/api/world/socket` WebSocket endpoint on the same port. Movement uses WebSockets:
clients send control changes, plus small keepalives (250 ms while moving, 5 seconds
while idle). The server advances active rooms and broadcasts snapshots at 20 Hz,
so other players and traffic remain live while you stand still. Positions and
collisions remain server-authoritative; rendering uses the existing interpolation.
Sockets authenticate with the room token in the first message, reconnect after
brief outages, and stop controls on disconnect. Stale controls stop after 500 ms;
sessions expire after 15 seconds without a client heartbeat.

**Restart with `npm run dev` after installing these changes.** Running `next dev`
or `next start` directly bypasses the WebSocket server. Server-side changes require
a restart; Next.js still refreshes browser components during development.

Deploy with `npm run build` and `npm start` on **one persistent Node.js instance**
and share its public URL. On Render, use `npm run build` as the build command
and `npm start` as the start command (with dependencies installed first). The server
uses `PORT` from the host. Any reverse proxy must forward WebSocket Upgrade
requests to the same Node process; HTTPS pages automatically connect using WSS. Rooms reset on process restart. This implementation
is not suitable for distributed/serverless instances without a shared room
service or sticky routing. Configure the same Laravel/account environment variables as before. Internet play requires a
reachable hosted server; this repository does not deploy one automatically.

## Checks

- `npm run lint`
- `npx tsc --noEmit`
- `node --test tests/multiplayer.test.mjs`
- `node --import tsx --test tests/world-socket.test.ts`

Tests cover two-client visibility, movement, room isolation, exclusive vehicle
ownership, driving, safe exit, disconnect cleanup, capacity, and API validation.

The WebSocket test opens a temporary local port and verifies session authentication,
idle broadcasts, two-client movement, stale input rejection, reconnects, malformed
controls, and safe stopping on disconnect.
