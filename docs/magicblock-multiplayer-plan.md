# BRUME multiplayer and MagicBlock plan

## What runs today

BRUME movement presence currently uses the lightweight WebSocket transport in
`multiplayer/server.ts`. It is an off-chain, server-authoritative presence layer.
It is **not** executing movement on MagicBlock, an Ephemeral Rollup, or Solana.

The socket server owns temporary session IDs, validates movement speed and world
bounds, broadcasts accepted transforms, and removes disconnected players. The
browser keeps rendering and collision detection in the existing React Three
Fiber world.

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
wallet identities; both players need wallet authentication before an on-chain
session is created.

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

- MagicBlock Ephemeral Rollups SDK: <https://github.com/magicblock-labs/ephemeral-rollups-sdk>
- MagicBlock integration examples: <https://github.com/magicblock-labs/magicblock-engine-examples>
- MagicBlock delegation program instructions: <https://github.com/magicblock-labs/delegation-program>
