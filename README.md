# BRUME World

BRUME World is an explorable, low-poly 3D product city built with Next.js, React Three Fiber, Three.js, and Drei.

Players can walk or run through the procedural environment, orbit and zoom a third-person camera, interact with billboards and saved buildings, and add a paid building through the existing Dodo checkout flow.

Multiplayer presence runs through a small server-authoritative Bun WebSocket
service. It synchronizes accepted player transforms, validates speed and world
bounds, supports short reconnects, and powers the live connection counter.

## Controls

- `WASD` or arrow keys — move relative to the camera
- `Shift` — run
- Mouse drag — rotate the camera
- Mouse wheel — zoom
- `E` — interact with a nearby object
- `Escape` — close an interaction panel

## Development

Run the web app and multiplayer server in separate terminals:

```bash
bun run dev
bun run dev:multiplayer
```

Open [http://localhost:3000](http://localhost:3000). The landing page links to the playable world at `/flash-arena`.

The browser defaults to `ws://localhost:8788/multiplayer` during local
development. Set `NEXT_PUBLIC_MULTIPLAYER_WS_URL` at build time when the socket
server is hosted elsewhere. The WebSocket server accepts these optional runtime
variables:

- `MULTIPLAYER_PORT` — defaults to `8788`
- `MULTIPLAYER_ALLOWED_ORIGINS` — comma-separated browser origins

The current Vinext deployment serves the frontend on Cloudflare Workers; deploy
the stateful WebSocket process separately (or migrate it to a Durable Object)
and point the frontend at its public `wss://` URL.

## Checks

```bash
bun run lint
bunx tsc --noEmit
bun run test:multiplayer
bun run build
```

With both local servers running, a Chrome-based two-tab smoke test is also
available:

```bash
BRUME_TEST_URL=http://127.0.0.1:3000/flash-arena \
  bun run test:multiplayer:browser
```

Set `CHROME_BIN` if Chrome is installed outside the standard macOS location.

Building persistence uses Neon Postgres, Upstash Redis caches shared data, and
Dodo handles the existing checkout flow. The future MagicBlock interaction
session design is documented in
[`docs/magicblock-multiplayer-plan.md`](docs/magicblock-multiplayer-plan.md).
