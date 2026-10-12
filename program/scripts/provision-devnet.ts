import { homedir } from "node:os";
import { join } from "node:path";
import { AnchorProvider, Program, Wallet, web3 } from "@coral-xyz/anchor";
import {
  DELEGATION_PROGRAM_ID,
  GetCommitmentSignature,
} from "@magicblock-labs/ephemeral-rollups-sdk";
import idl from "../target/idl/brume_world.json";
import type { BrumeWorld } from "../target/types/brume_world";

const BASE_RPC = process.env.BRUME_BASE_RPC_URL ?? "https://api.devnet.solana.com";
const BASE_WS = process.env.BRUME_BASE_WS_URL ?? "wss://api.devnet.solana.com";
const ER_RPC = process.env.BRUME_ER_RPC_URL ?? "https://devnet-as.magicblock.app";
const ER_WS = process.env.BRUME_ER_WS_URL ?? "wss://devnet-as.magicblock.app";
const MAGICBLOCK_VALIDATOR = new web3.PublicKey(
  process.env.BRUME_MAGICBLOCK_VALIDATOR ??
    "MAS1Dt9qreoRMQ14YQuhg8UTZMMzDdKhmkZMECCzk57",
);
const WORLD_SESSION_SEED = Buffer.from("world-session");
const WORLD_ID = [...Buffer.from("BRUME-WORLD-V1\0\0")];

const sleep = (milliseconds: number) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

async function waitFor<T>(
  label: string,
  read: () => Promise<T | null>,
  timeoutMs = 90_000,
): Promise<T> {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    const value = await read();
    if (value !== null) return value;
    await sleep(750);
  }

  throw new Error(`Timed out waiting for ${label}`);
}

async function main() {
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
  const baseProgram = new Program<BrumeWorld>(
    idl as BrumeWorld,
    new AnchorProvider(baseConnection, wallet, { commitment: "confirmed" }),
  );
  const erProgram = new Program<BrumeWorld>(
    idl as BrumeWorld,
    new AnchorProvider(erConnection, wallet, { commitment: "confirmed" }),
  );
  const [worldSession] = web3.PublicKey.findProgramAddressSync(
    [WORLD_SESSION_SEED, wallet.publicKey.toBuffer(), Buffer.from(WORLD_ID)],
    baseProgram.programId,
  );

  let initializeSignature: string | null = null;
  let delegateSignature: string | null = null;

  const existingBaseAccount = await baseConnection.getAccountInfo(
    worldSession,
    "confirmed",
  );

  if (!existingBaseAccount) {
    initializeSignature = await baseProgram.methods
      .initializeWorldSession(WORLD_ID)
      .accountsPartial({
        worldSession,
        authority: wallet.publicKey,
        systemProgram: web3.SystemProgram.programId,
      })
      .rpc();
  } else if (
    !existingBaseAccount.owner.equals(baseProgram.programId) &&
    !existingBaseAccount.owner.equals(DELEGATION_PROGRAM_ID)
  ) {
    throw new Error(
      `WorldSession has unexpected owner ${existingBaseAccount.owner.toBase58()}`,
    );
  }

  const currentBaseAccount = await baseConnection.getAccountInfo(
    worldSession,
    "confirmed",
  );

  if (currentBaseAccount?.owner.equals(baseProgram.programId)) {
    delegateSignature = await baseProgram.methods
      .delegateWorldSession(WORLD_ID)
      .accountsPartial({ payer: wallet.publicKey, pda: worldSession })
      .remainingAccounts([
        { pubkey: MAGICBLOCK_VALIDATOR, isSigner: false, isWritable: false },
      ])
      .rpc();
  }

  await waitFor("the delegated WorldSession on the ER", async () => {
    const account = await erConnection.getAccountInfo(worldSession, "confirmed");
    return account?.data.length ? account : null;
  });

  const interactionSignature = await erProgram.methods
    .recordInteraction({ player: {} })
    .accountsPartial({ worldSession, actor: wallet.publicKey })
    .rpc();

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
  const state = await erProgram.account.worldSession.fetch(worldSession);

  console.info(
    "BRUME_MAGICBLOCK_PROOF=" +
      JSON.stringify({
        cluster: "devnet",
        programId: baseProgram.programId.toBase58(),
        authority: wallet.publicKey.toBase58(),
        worldIdUtf8: "BRUME-WORLD-V1",
        worldIdBytes: WORLD_ID,
        worldSessionPda: worldSession.toBase58(),
        magicBlockValidator: MAGICBLOCK_VALIDATOR.toBase58(),
        baseRpc: BASE_RPC,
        ephemeralRpc: ER_RPC,
        initializeSignature,
        delegateSignature,
        initialErInteractionSignature: interactionSignature,
        erCommitSignature: commitSignature,
        baseCommitSignature,
        interactionCount: Number(state.interactionCount),
        lastActor: state.lastActor.toBase58(),
        provisionedAt: new Date().toISOString(),
      }),
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
