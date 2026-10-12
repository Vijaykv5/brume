# BRUME MagicBlock integration runbook

## Qualifying integration

BRUME should use a MagicBlock Ephemeral Rollup for explicit, auditable social
interactions. Keep high-frequency avatar transforms on the existing WebSocket
presence layer. Record actions such as `wave`, `meet`, `accept_chat`, or quest
progress in a delegated `WorldSession` PDA.

This is a real ER integration only after the program is deployed, the PDA is
delegated through MagicBlock's Delegation Program, at least one instruction is
executed against the delegated account through the Magic Router or ER RPC, and
the resulting state is committed back to Solana.

## Implemented Anchor account

```rust
#[account]
pub struct WorldSession {
    pub authority: Pubkey,
    pub world_id: [u8; 16],
    pub bump: u8,
    pub interaction_count: u64,
    pub last_actor: Pubkey,
    pub last_interaction: InteractionKind,
    pub last_interaction_at: i64,
}
```

Derive it with:

```text
["world-session", authority_public_key, world_id]
```

Minimum program instructions:

1. `initialize_world_session(world_id)` — create the PDA on Solana devnet.
2. `delegate_world_session()` — delegate the PDA using
   `ephemeral-rollups-sdk` and a selected MagicBlock validator.
3. `record_interaction(action)` — mutate the delegated PDA on the ER.
4. `commit_world_session()` — commit a checkpoint to Solana.
5. `commit_and_undelegate_world_session()` — commit final state and return PDA
   ownership to the BRUME program.

The implementation lives in `program/programs/brume-world`. It pins Anchor
`1.1.2` and MagicBlock's `ephemeral-rollups-sdk` `0.17.3` with its `anchor`
feature. The locally generated deployment address is:

```text
5dhS3bs4CfLaNq6sEvwnDcqkTjkYPKYeettb2BE47C7p
```

This address is deployed on devnet and is linked in the proof section below.

## Devnet endpoints and dependencies

```text
Solana devnet RPC:       https://api.devnet.solana.com
MagicBlock AS ER:       https://devnet-as.magicblock.app
MagicBlock AS WebSocket:wss://devnet-as.magicblock.app
MagicBlock validator:   MAS1Dt9qreoRMQ14YQuhg8UTZMMzDdKhmkZMECCzk57
Delegation Program:     DELeGGvXpWV2fqJUhqcF5ZSYMS4JTLjteaAMARRSaeSh
```

The deployment pins the AS validator identity returned by the live ER RPC.

## Transaction routing

- Initialize and delegate: send to Solana devnet.
- Mutate delegated `WorldSession`: send through Magic Router or the resolved ER
  validator RPC.
- Commit and undelegate: initiate on the ER; wait for the corresponding
  base-layer commit transaction.
- Direct SOL payments: keep on Solana devnet and separate from the delegated
  interaction state.

## Frontend proof experience

Add a small `MagicBlock Live` panel to the arena after deployment. It should
show:

- `ER connected` or a specific error state.
- BRUME program address with copy and explorer actions.
- `WorldSession` PDA with copy and explorer actions.
- Delegation status and selected validator.
- Last ER transaction signature.
- Last Solana commit signature.
- Interaction count read from the delegated account.

The nearby-player menu starts a `BRUME Encounter`: an on-chain high five or a
rock–paper–scissors match. The WebSocket server owns the short-lived invitation,
keeps each RPS choice private until both players lock in, and resolves the
result. The initiator then sends `record_session_encounter` to the ER, recording
the wallet-authenticated actor, target wallet, outcome, and interaction count.

Browser wallet extensions may reject an ER blockhash as a network mismatch
because it is outside Solana's devnet blockhash domain. BRUME now creates a
`SessionTokenV2` through MagicBlock's session program using one ordinary devnet
wallet transaction. A short-lived in-memory key signs later gasless ER actions,
and the BRUME program validates the session token against the connected wallet
on every settlement.

## Live devnet proof

Provisioned on 2026-10-12. The `WorldSession` remains delegated so the frontend
can submit `record_interaction` directly to the ER.

```text
Program address
https://explorer.solana.com/address/5dhS3bs4CfLaNq6sEvwnDcqkTjkYPKYeettb2BE47C7p?cluster=devnet

WorldSession PDA
https://explorer.solana.com/address/3UrnvFqSpYMdCWY1psEiyii2EKANpxnv4q7uWu3xCmv7?cluster=devnet

Program deployment
https://explorer.solana.com/tx/5GecY3pqpesyCGTmV3CPKXdy7ZJJcdz2AQtrHcfMiPqaiFdm7BvRjcKGRyVSy1WxqzZ4xeoCW2dUhQQuZjrpDB8L?cluster=devnet

Initialization
https://explorer.solana.com/tx/4TbZyh1eeGHUFowsFmdSv6Ex7sjci5MsRTMZ1NZUJwpcJPpki4z3a47Z9QVbZNJpVSDTbJ8JugBz6TXJSX7fiYU3?cluster=devnet

Delegation (recommended hackathon integration proof)
https://explorer.solana.com/tx/4Jp9D8WxXyTtNJ2fhbtZbEEFWEgpaL8yRTP3BL9CnwRiHKnRdMLdX5X6NGbfVHKvDFtrC1RwLZKpSfZj7PcdQkbM?cluster=devnet

Committed checkpoint on Solana
https://explorer.solana.com/tx/4uSFtnZNbQV334L4yAXPfSUwkdmZYZSbVm2Ga187tCzijbyAwxk4LYK2BuaR9cpnLg5FKiygfFAGfQA95BoZPZHs?cluster=devnet
```

Use the delegation or committed-checkpoint transaction as the hackathon's
`Explorer link (integration proof)`. Put the deployed BRUME program ID—not the
MagicBlock Delegation Program ID—in the submission's `Program addresses`
field. Mention the Delegation Program separately as an integration dependency.

## Delivery milestones

1. **Complete:** scaffold and locally compile the Anchor + ER program.
2. **Complete:** add a local lifecycle test covering initialization, delegation,
   ER interaction updates, a base-layer commit, and final undelegation.
3. **Complete:** deploy to devnet; initialize and delegate a real `WorldSession` PDA.
4. **Complete:** add wallet-authorized session keys and two-player BRUME Encounters.
5. **Complete:** commit the state, display proof links, and record the signatures for the
   submission.

## Optional VRF follow-up

If time remains, add MagicBlock VRF for randomized spawn rewards or world event
selection. VRF should be an actual gameplay mechanic, not a disconnected
random-number demo. The ER integration above already satisfies the stated
“Ephemeral Rollup or VRF” requirement.

## Reproducing the local proof

Run these in three terminals from the repository root:

```sh
# Terminal 1
bun run dev:magicblock

# Terminal 2
bun run build:chain
bun run deploy:chain:local

# Terminal 3
bun run test:chain:integration
```

The integration test prints all local base-layer and ER transaction signatures,
the generated `WorldSession` PDA, and the BRUME program address. These local
signatures prove the implementation works during development, but the
hackathon explorer proof must come from the devnet milestone.

To re-check or re-provision the deterministic devnet session:

```sh
bun run provision:magicblock:devnet
```

The command is idempotent for initialization and delegation. It records a test
interaction and creates a fresh Solana checkpoint on every successful run.
