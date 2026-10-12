# BRUME World on-chain program

This Anchor workspace contains the durable session state used by BRUME's
MagicBlock Ephemeral Rollup integration.

The `WorldSession` PDA stores auditable interaction activity. Avatar movement
continues to use the existing WebSocket presence server; it is intentionally not
written on-chain every frame.

## Lifecycle

1. `initialize_world_session` creates the PDA on Solana.
2. `delegate_world_session` delegates it to a MagicBlock validator.
3. `record_interaction` runs against the Ephemeral Rollup for low-latency state.
4. `commit_world_session` checkpoints the current state back to Solana.
5. `commit_and_undelegate_world_session` finalizes the state and returns the PDA
   to the BRUME program on Solana.

## Local verification

```sh
cd chain
cargo test
anchor build
```

## Full local MagicBlock lifecycle

Use three terminals from the repository root.

Terminal 1 starts the base validator, Ephemeral Rollup, and public query layer:

```sh
bun run dev:magicblock
```

Terminal 2 builds and deploys BRUME to the temporary base validator:

```sh
bun run build:chain
bun run deploy:chain:local
```

Terminal 3 runs initialize, delegate, ER interaction, commit, a second ER
interaction, and commit-and-undelegate:

```sh
bun run test:chain:integration
```

The local endpoints are `8899` for Solana, `7799` for the ER, and `6699` for
MagicBlock's public query-filtering service. Stop Terminal 1 with `Ctrl-C`.

The deploy keypair under `target/deploy` is local-only and ignored by Git. The
public program address is:

```text
5dhS3bs4CfLaNq6sEvwnDcqkTjkYPKYeettb2BE47C7p
```

Devnet deployment and live ER delegation are separate, explicit milestones.

