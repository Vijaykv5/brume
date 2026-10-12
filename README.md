# BRUME World

BRUME World is an explorable, low-poly 3D product city built with Next.js, React Three Fiber, Three.js, and Drei.

Players can walk or run through the procedural environment, orbit and zoom a third-person camera, interact with billboards and saved buildings, and add a paid building through the existing Dodo checkout flow.

## Controls

- `WASD` or arrow keys — move relative to the camera
- `Shift` — run
- Mouse drag — rotate the camera
- Mouse wheel — zoom
- `E` — interact with a nearby object
- `Escape` — close an interaction panel

## Development

```bash
bun run dev
```

Open [http://localhost:3000](http://localhost:3000). The landing page links to the playable world at `/flash-arena`.

## Checks

```bash
bun run lint
bunx tsc --noEmit
bun run build
```

The app deploys through Vinext and Cloudflare Workers. Building persistence uses Neon Postgres, Upstash Redis provides cache and presence data, and Dodo handles the existing checkout flow.
