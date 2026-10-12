import { randomBytes } from "node:crypto";
import { homedir } from "node:os";
import { join } from "node:path";
import { expect, test } from "bun:test";
import { AnchorProvider, Program, Wallet, web3 } from "@coral-xyz/anchor";
import {
  DELEGATION_PROGRAM_ID,
  GetCommitmentSignature,
} from "@magicblock-labs/ephemeral-rollups-sdk";
import idl from "../target/idl/brume_world.json";
import type { BrumeWorld } from "../target/types/brume_world";

const BASE_RPC = process.env.BRUME_BASE_RPC_URL ?? "http://127.0.0.1:8899";
const BASE_WS = process.env.BRUME_BASE_WS_URL ?? "ws://127.0.0.1:8900";
const ER_RPC = process.env.BRUME_ER_RPC_URL ?? "http://127.0.0.1:7799";
const ER_WS = process.env.BRUME_ER_WS_URL ?? "ws://127.0.0.1:7800";
const LOCAL_VALIDATOR = new web3.PublicKey(
  process.env.BRUME_MAGICBLOCK_VALIDATOR ??
    "mAGicPQYBMvcYveUZA5F5UNNwyHvfYh5xkLS2Fr1mev",
);
const WORLD_SESSION_SEED = Buffer.from("world-session");

type DecodedWorldSession = {
  interactionCount: { toNumber(): number };
  lastActor: web3.PublicKey;
};

const sleep = (milliseconds: number) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

async function waitFor<T>(
  label: string,
  read: () => Promise<T | null>,
  timeoutMs = 30_000,
): Promise<T> {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    const value = await read();
    if (value !== null) return value;
    await sleep(300);
  }

  throw new Error(`Timed out waiting for ${label}`);
}

test(
  "runs the WorldSession through the MagicBlock delegation lifecycle",
  async () => {
    process.env.ANCHOR_WALLET ??= join(
      homedir(),
      ".config",
      "solana",
      "id.json",
    );
    const wallet = Wallet.local();
    const baseConnection = new web3.Connection(BASE_RPC, {
      wsEndpoint: BASE_WS,
      commitment: "confirmed",
    });
    const erConnection = new web3.Connection(ER_RPC, {
      wsEndpoint: ER_WS,
      commitment: "confirmed",
    });
    const baseProvider = new AnchorProvider(baseConnection, wallet, {
      commitment: "confirmed",
    });
    const erProvider = new AnchorProvider(erConnection, wallet, {
      commitment: "confirmed",
    });
    const baseProgram = new Program<BrumeWorld>(idl as BrumeWorld, baseProvider);
    const erProgram = new Program<BrumeWorld>(idl as BrumeWorld, erProvider);
    const worldId = [...randomBytes(16)];
    const [worldSession] = web3.PublicKey.findProgramAddressSync(
      [WORLD_SESSION_SEED, wallet.publicKey.toBuffer(), Buffer.from(worldId)],
      baseProgram.programId,
    );

    const initializeSignature = await baseProgram.methods
      .initializeWorldSession(worldId)
      .accountsPartial({
        worldSession,
        authority: wallet.publicKey,
        systemProgram: web3.SystemProgram.programId,
      })
      .rpc();

    const initialized = await baseProgram.account.worldSession.fetch(worldSession);
    expect(initialized.authority.equals(wallet.publicKey)).toBe(true);
    expect(Number(initialized.interactionCount)).toBe(0);

    const delegateSignature = await baseProgram.methods
      .delegateWorldSession(worldId)
      .accountsPartial({
        payer: wallet.publicKey,
        pda: worldSession,
      })
      .remainingAccounts([
        { pubkey: LOCAL_VALIDATOR, isSigner: false, isWritable: false },
      ])
      .rpc();

    await waitFor("the delegated WorldSession on the ER", async () => {
      const account = await erConnection.getAccountInfo(worldSession, "confirmed");
      return account?.data.length ? account : null;
    });

    const delegatedBaseAccount = await baseConnection.getAccountInfo(
      worldSession,
      "confirmed",
    );
    expect(delegatedBaseAccount?.owner.equals(DELEGATION_PROGRAM_ID)).toBe(true);

    const interactionSignature = await erProgram.methods
      .recordInteraction({ billboard: {} })
      .accountsPartial({ worldSession, actor: wallet.publicKey })
      .rpc();

    const erState = await erProgram.account.worldSession.fetch(worldSession);
    expect(Number(erState.interactionCount)).toBe(1);
    expect(erState.lastActor.equals(wallet.publicKey)).toBe(true);

    const commitSignature = await erProgram.methods
      .commitWorldSession()
      .accountsPartial({
        payer: wallet.publicKey,
        worldSession,
        authority: wallet.publicKey,
      })
      .rpc();
    const baseCommitSignature = await GetCommitmentSignature(
      commitSignature,
      erConnection,
    );

    await erProgram.methods
      .recordInteraction({ player: {} })
      .accountsPartial({ worldSession, actor: wallet.publicKey })
      .rpc();

    const undelegateSignature = await erProgram.methods
      .commitAndUndelegateWorldSession()
      .accountsPartial({
        payer: wallet.publicKey,
        worldSession,
        authority: wallet.publicKey,
      })
      .rpc();
    const baseUndelegateSignature = await GetCommitmentSignature(
      undelegateSignature,
      erConnection,
    );

    const finalState = await waitFor<DecodedWorldSession>(
      "the WorldSession to return to the BRUME program",
      async () => {
        const account = await baseConnection.getAccountInfo(
          worldSession,
          "confirmed",
        );
        if (!account?.owner.equals(baseProgram.programId)) return null;
        return baseProgram.coder.accounts.decode(
          "worldSession",
          account.data,
        ) as DecodedWorldSession;
      },
    );

    expect(finalState.interactionCount.toNumber()).toBe(2);
    expect(finalState.lastActor.equals(wallet.publicKey)).toBe(true);

    console.info(
      JSON.stringify(
        {
          programId: baseProgram.programId.toBase58(),
          worldSession: worldSession.toBase58(),
          initializeSignature,
          delegateSignature,
          interactionSignature,
          commitSignature,
          baseCommitSignature,
          undelegateSignature,
          baseUndelegateSignature,
        },
        null,
        2,
      ),
    );
  },
  120_000,
);

