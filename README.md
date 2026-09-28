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

This implementation uses a server-authoritative in-memory simulation and HTTP
snapshot polling approximately 10 times per second, with client-side smoothing.
Clients send controls, not positions. Vehicle claims, collisions, and movement
are resolved on the server. Idle input stops after 500 ms; disconnected players
expire after 15 seconds and release their vehicles. Empty rooms are discarded.

Deploy with `npm run build` and `npm start` on **one persistent Node.js instance**
and share its public URL. Rooms reset on process restart. This implementation
is not suitable for distributed/serverless instances without a shared room
service or sticky routing. It is a small multiplayer prototype, with no accounts,
persistent progress, or production abuse protection. Internet play requires a
reachable hosted server; this repository does not deploy one automatically.

## Checks

- `npm run lint`
- `npx tsc --noEmit`
- `node --test tests/multiplayer.test.mjs`

Tests cover two-client visibility, movement, room isolation, exclusive vehicle
ownership, driving, safe exit, disconnect cleanup, capacity, and API validation.
