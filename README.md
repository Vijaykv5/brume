# BRUME World

BRUME World is an explorable, low-poly 3D product city built with Next.js, React Three Fiber, Three.js, and Drei.

Players can walk or run through the procedural environment, orbit and zoom a third-person camera, interact with billboards and saved buildings, and add a paid building through the existing Dodo checkout flow.

The arena is wallet-gated through Solana Wallet Adapter. Phantom, Solflare, and
other Wallet Standard wallets can connect without BRUME maintaining a custom
wallet list. The connected public key is attached to the current multiplayer
avatar without a second signing prompt, and nearby players can send an explicit,
wallet-approved SOL transfer from the interaction menu.

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
- `SOLANA_RPC_URL` — server-side RPC used to verify confirmed payment receipts;
  defaults to Solana devnet

The frontend accepts these build-time variables:

- `NEXT_PUBLIC_SOLANA_NETWORK` — `devnet` (default), `testnet`, or `mainnet-beta`
- `NEXT_PUBLIC_SOLANA_RPC_URL` — optional public RPC endpoint for balances and
  transactions
- `NEXT_PUBLIC_MULTIPLAYER_WS_URL` — public `wss://` multiplayer endpoint
- `NEXT_PUBLIC_MAGICBLOCK_RPC_URL` — optional MagicBlock ER override; defaults
  to the public AS devnet endpoint used by the delegated session

The frontend and multiplayer server must use the same Solana cluster. For a
hackathon demo, keep both on devnet until the complete payment flow has been
tested with two wallets.

The current Vinext deployment serves the frontend on Cloudflare Workers; deploy
the stateful WebSocket process separately (or migrate it to a Durable Object)
and point the frontend at its public `wss://` URL.

## MagicBlock program

The `program/` Anchor workspace contains BRUME's deployed `WorldSession` program. It
keeps per-frame movement on the existing WebSocket server while recording
explicit world interactions in a PDA that can be delegated to a MagicBlock
Ephemeral Rollup, committed, and undelegated back to Solana.

```bash
bun run test:chain
bun run build:chain
```

The devnet program address is
[`5dhS…7C7p`](https://explorer.solana.com/address/5dhS3bs4CfLaNq6sEvwnDcqkTjkYPKYeettb2BE47C7p?cluster=devnet).
The deterministic `WorldSession` PDA is delegated to MagicBlock and the arena's
nearby-player menu starts two-player BRUME Encounters. Players can exchange a
high five or play rock–paper–scissors with private choices; the multiplayer
server resolves the live match and the initiating wallet's scoped session key
records both participants and the final outcome on the ER. Run
`bun run provision:magicblock:devnet` to re-check the session and commit a new
checkpoint. Full addresses and transaction proof are in
[`docs/magicblock-integration-runbook.md`](docs/magicblock-integration-runbook.md).

The first encounter in a browser tab asks for one normal Solana devnet wallet
approval. Later encounter settlements are gasless and do not trigger repeated
wallet popups. Use `bun run test:chain:session:devnet` to verify this lifecycle
against the live devnet program and MagicBlock ER.

## Checks

```bash
bun run lint
bunx tsc --noEmit
bun run test:multiplayer
bun run test:chain
bun run build:chain
bun run build
```

With both local servers running, a Chrome-based smoke test is also available.
In a headless browser it verifies that disconnected visitors see the wallet
gate and the standard Wallet Adapter modal. Full two-player movement and
payment testing requires two browser profiles with wallet extensions:

```bash
BRUME_TEST_URL=http://127.0.0.1:3000/flash-arena \
  bun run test:multiplayer:browser
```

Set `CHROME_BIN` if Chrome is installed outside the standard macOS location.

Building persistence uses Neon Postgres, Upstash Redis caches shared data, and
Dodo handles the existing checkout flow. The MagicBlock interaction architecture
and future extensions are documented in
[`docs/magicblock-multiplayer-plan.md`](docs/magicblock-multiplayer-plan.md).
