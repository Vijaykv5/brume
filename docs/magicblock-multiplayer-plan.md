# BRUME multiplayer and MagicBlock plan

## What runs today

BRUME movement presence currently uses the lightweight WebSocket transport in
`multiplayer/server.ts`. It is an off-chain, server-authoritative presence layer.
It is **not** executing movement on MagicBlock, an Ephemeral Rollup, or Solana.

The wallet adapter's connected public key is associated with the current
multiplayer avatar without requesting a second message signature. This keeps
arena entry to one wallet-connect action. It is session metadata, not a
cryptographic server-side identity proof. SOL transfers are normal
wallet-approved Solana System Program transfers, and the multiplayer server
independently verifies a confirmed transaction before showing a receipt to a
connected recipient. Neither operation currently runs through MagicBlock.

The socket server owns temporary session IDs, validates movement speed and world
bounds, broadcasts accepted transforms, and removes disconnected players. The
browser keeps rendering and collision detection in the existing React Three
Fiber world.

## Why MagicBlock fits BRUME

MagicBlock is useful here for **consented shared game state**, not for making
ordinary movement on-chain. Ephemeral Rollups can execute delegated Solana
account state with low latency and high throughput, then commit results back to
Solana. That is a strong match for short-lived interactions such as accepting a
chat or gas request, multiplayer quests, shared objects, and session-scoped
social actions that need an auditable outcome.

Privacy is an optional second use case. MagicBlock Private Ephemeral Rollups
use a trusted execution environment for confidential state and transactions;
they are a separate product choice rather than an automatic property of every
Ephemeral Rollup. BRUME could later use one for private rooms or sealed social
actions if the product needs confidentiality.

MagicBlock is not an ERC-20 rollup. BRUME is a Solana application: SOL is the
native currency and fungible tokens use the SPL Token programs. MagicBlock's
Ephemeral SPL Token support could become relevant for high-frequency in-world
token actions, but it is not needed for the direct SOL transfer implemented in
this phase.

## Proposed Anchor account

The best first MagicBlock account is an `InteractionSession` PDA—not a
per-frame player-position account. Derive it from:

```text
["interaction", world_pubkey, initiator_pubkey, counterparty_pubkey, nonce]
```

Suggested fields:

```text
world: Pubkey
initiator: Pubkey
counterparty: Pubkey
interaction_kind: u8
status: u8
sequence: u64
created_slot: u64
expires_at: i64
last_action_hash: [u8; 32]
bump: u8
```

This account maps cleanly to future nearby-player actions such as accepting a
chat request, acknowledging a gas request, or coordinating an explicitly
authorized payment. Anonymous WebSocket session IDs must never be treated as
wallet identities. Before creating an on-chain session, the Anchor instruction
must require the relevant wallet signer; the off-chain connected-address field
alone is not sufficient authorization.

## Intended delegation lifecycle

1. **Create on Solana:** after both wallets consent, initialize the
   `InteractionSession` PDA on the base layer.
2. **Delegate:** call the BRUME Anchor program's delegation instruction using
   MagicBlock's Ephemeral Rollups SDK. Delegate only the interaction PDA and any
   purpose-built session state required for the interaction.
3. **Execute:** route interaction instructions to the Ephemeral Rollup for
   low-latency acknowledgements and state changes. A session key can later
   reduce repeated wallet prompts, subject to scoped permissions and expiry.
4. **Commit:** periodically commit checkpoints, and always commit the terminal
   interaction state back to Solana.
5. **Undelegate/finalize:** end or time out the session, commit the last state,
   and undelegate the PDA so the canonical base-layer account is available
   again.

Real SOL transfers should remain explicit, wallet-authorized financial actions.
They should not be inferred from proximity or delegated together with ordinary
movement state. A future implementation can use a dedicated base-layer
instruction or a carefully scoped Magic Action after a confirmation screen.

## Why movement stays off-chain for now

Player transforms are high-frequency, disposable presence data. Persisting each
frame would couple rendering latency to chain execution and create state that has
little long-term value. The modular boundary is intentional:

- WebSocket layer: presence, transforms, interpolation, proximity.
- Anchor/MagicBlock layer: consented, auditable interaction-session state.
- Solana base layer: canonical settlement and any future value transfer.

## Primary references

- MagicBlock, “Why MagicBlock?”: <https://docs.magicblock.gg/pages/get-started/introduction/why-magicblock>
- MagicBlock game architecture: <https://docs.magicblock.gg/pages/get-started/use-cases/games>
- MagicBlock products: <https://docs.magicblock.gg/pages/overview/products>
- Solana Wallet Adapter: <https://solana.com/developers/cookbook/wallets/connect-wallet-react>
- Solana message signing and authentication: <https://solana.com/docs/frontend/messages-and-auth>
