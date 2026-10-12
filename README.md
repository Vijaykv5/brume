# BRUME World

**Meet inside BRUME.** Explore a shared 3D island, discover projects, and make social moments with other Solana users.

BRUME World is a browser-based multiplayer social world. Players connect a Solana wallet, customize an explorer, move through a low-poly city, and meet nearby players for high fives or private-choice rock-paper-scissors. Meaningful encounters can be verified on a MagicBlock Ephemeral Rollup and committed to Solana devnet. Movement stays on the multiplayer service, keeping the world responsive without sending every step on-chain.

## Try BRUME

- **Live world:** [brume-world.vijaydevworks001.workers.dev](https://brume-world.vijaydevworks001.workers.dev)
- **BRUME program on devnet:** [5dhS3bs4CfLaNq6sEvwnDcqkTjkYPKYeettb2BE47C7p](https://explorer.solana.com/address/5dhS3bs4CfLaNq6sEvwnDcqkTjkYPKYeettb2BE47C7p?cluster=devnet)
- **MagicBlock delegation proof:** [WorldSession delegation transaction](https://explorer.solana.com/tx/4Jp9D8WxXyTtNJ2fhbtZbEEFWEgpaL8yRTP3BL9CnwRiHKnRdMLdX5X6NGbfVHKvDFtrC1RwLZKpSfZj7PcdQkbM?cluster=devnet)
- **Committed checkpoint:** [WorldSession commit transaction](https://explorer.solana.com/tx/4uSFtnZNbQV334L4yAXPfSUwkdmZYZSbVm2Ga187tCzijbyAwxk4LYK2BuaR9cpnLg5FKiygfFAGfQA95BoZPZHs?cluster=devnet)
- **Demo script:** [3–4 minute video write-up](docs/brume-world-demo-writeup.html)

The arena currently targets Solana devnet. Use a devnet wallet with a small SOL balance for wallet approvals and transfers.

## What you can do

- Explore the island city with keyboard movement and a third-person camera.
- Customize your explorer and see other connected players in real time.
- Visit interactive project buildings and billboards.
- Start a nearby-player high five or rock-paper-scissors encounter. Choices stay private until both players lock them in.
- Send an explicit, wallet-approved SOL transfer to another nearby player.
- Inspect the MagicBlock connection, session account, and transaction proofs in the in-world **MagicBlock Live** panel.
- Disconnect your wallet from the wallet card at the bottom left of the arena.

## Run locally

### Requirements

- [Bun](https://bun.sh/) 1.3.14
- A Solana wallet browser extension for arena flows
- Two browser profiles with wallets for a full multiplayer encounter

Install dependencies and create a local environment file:

```bash
bun install --frozen-lockfile
cp .env.example .env
```

Start the web app and multiplayer service in separate terminals:

```bash
bun run dev
```

```bash
bun run dev:multiplayer
```

Open [http://localhost:3000](http://localhost:3000), then select **Enter arena**. Local frontend and multiplayer defaults use `ws://localhost:8788/multiplayer` and Solana devnet. Add service credentials to `.env` only when using the associated persistence or payment integrations; never commit `.env`.

### Controls

| Input | Action |
| --- | --- |
| `WASD` or arrow keys | Move relative to the camera |
| `Shift` | Run |
| Mouse drag | Rotate the camera |
| Mouse wheel | Zoom |
| `E` | Interact with a nearby object or player |
| `Escape` | Close an interaction panel |

## How MagicBlock is used

BRUME stores social activity in a deterministic `WorldSession` PDA owned by the deployed Anchor program. The session is initialized on Solana devnet, delegated to a MagicBlock validator, updated on the Ephemeral Rollup, and committed back to Solana. A wallet-approved, program-scoped session token lets a temporary key authorize later encounter actions without repeated wallet pop-ups. The program validates the authorization and encounter data before it updates the session.

The multiplayer service handles fast-changing presence and movement. It checks world bounds and movement speed, validates player proximity for encounters, keeps rock-paper-scissors choices private until both players submit, and verifies the settlement transaction. This keeps moment-to-moment play responsive while leaving meaningful interactions inspectable on-chain.

| Proof | Address |
| --- | --- |
| BRUME program | [`5dhS3bs4CfLaNq6sEvwnDcqkTjkYPKYeettb2BE47C7p`](https://explorer.solana.com/address/5dhS3bs4CfLaNq6sEvwnDcqkTjkYPKYeettb2BE47C7p?cluster=devnet) |
| WorldSession PDA | [`3UrnvFqSpYMdCWY1psEiyii2EKANpxnv4q7uWu3xCmv7`](https://explorer.solana.com/address/3UrnvFqSpYMdCWY1psEiyii2EKANpxnv4q7uWu3xCmv7?cluster=devnet) |
| Delegation transaction | [View on Solana Explorer](https://explorer.solana.com/tx/4Jp9D8WxXyTtNJ2fhbtZbEEFWEgpaL8yRTP3BL9CnwRiHKnRdMLdX5X6NGbfVHKvDFtrC1RwLZKpSfZj7PcdQkbM?cluster=devnet) |
| Base-layer commit | [View on Solana Explorer](https://explorer.solana.com/tx/4uSFtnZNbQV334L4yAXPfSUwkdmZYZSbVm2Ga187tCzijbyAwxk4LYK2BuaR9cpnLg5FKiygfFAGfQA95BoZPZHs?cluster=devnet) |

For the full lifecycle, reproduction instructions, and additional signatures, see the [MagicBlock integration runbook](docs/magicblock-integration-runbook.md).

## Architecture

- **World client:** Next.js, React, React Three Fiber, Three.js, and Vinext for the Cloudflare Workers build.
- **Wallet and chain:** Solana Wallet Adapter, an Anchor program, and MagicBlock Ephemeral Rollups.
- **Multiplayer:** Bun WebSocket service for authoritative presence and encounter coordination. The stateful WebSocket service is deployed separately from the Cloudflare frontend and must be configured with a public `wss://` endpoint for production multiplayer.
- **Persistence and services:** Neon Postgres and Upstash Redis are used by the persistence and cache layers; Dodo Payments is used by the checkout integration.

## Deploy to Cloudflare

The GitHub Actions workflow at [`.github/workflows/deploy-cloudflare.yml`](.github/workflows/deploy-cloudflare.yml) deploys `main` to the `brume-world` Worker. Each push to `main` installs the locked Bun dependencies, runs lint, builds and type-checks the app, builds Vinext, then deploys to Cloudflare.

Configure these GitHub Actions secrets for deployment:

- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_API_TOKEN`
- `DB_URL`
- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`

If Dodo checkout is enabled, set the `DODO_PAYMENTS_ENABLED` Actions variable to `true` and add the Dodo secrets listed in the workflow. The multiplayer WebSocket service still needs its own deployment and public URL; set `NEXT_PUBLIC_MULTIPLAYER_WS_URL` to that `wss://` address when building the frontend. Do not put secrets in `NEXT_PUBLIC_*` variables or commit them to the repository.

## Development checks

```bash
bun run lint
bunx tsc --noEmit
bun run test:multiplayer
bun run test:chain
bun run build:chain
bun run build
```

To run the end-to-end local MagicBlock lifecycle, use the instructions in [`program/README.md`](program/README.md). For browser smoke testing, start both local services and run:

```bash
BRUME_TEST_URL=http://127.0.0.1:3000/flash-arena bun run test:multiplayer:browser
```
