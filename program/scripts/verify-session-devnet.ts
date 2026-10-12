import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import {
  Connection,
  Keypair,
  PublicKey,
  sendAndConfirmTransaction,
  SystemProgram,
  Transaction,
  TransactionInstruction,
} from "@solana/web3.js";

const BASE_RPC = process.env.SOLANA_RPC_URL || "https://api.devnet.solana.com";
const ER_RPC = process.env.MAGICBLOCK_RPC_URL || "https://devnet-as.magicblock.app";
const PROGRAM_ID = new PublicKey("5dhS3bs4CfLaNq6sEvwnDcqkTjkYPKYeettb2BE47C7p");
const WORLD_SESSION = new PublicKey("3UrnvFqSpYMdCWY1psEiyii2EKANpxnv4q7uWu3xCmv7");
const SESSION_PROGRAM = new PublicKey("KeyspM2ssCJbqUhQ4k7sveSiY4WjnYsrXkC8oDbwde5");
const CREATE_SESSION_V2 = Uint8Array.from([223, 233, 108, 7, 65, 194, 235, 38]);
const RECORD_SESSION_ENCOUNTER = Uint8Array.from([232, 178, 131, 146, 212, 251, 164, 95]);

function encodeCreateSession(validUntil: number) {
  const data = new Uint8Array(28);
  data.set(CREATE_SESSION_V2);
  data[8] = 1;
  data[9] = 0;
  data[10] = 1;
  const view = new DataView(data.buffer);
  view.setBigInt64(11, BigInt(validUntil), true);
  data[19] = 1;
  view.setBigUint64(20, BigInt(0), true);
  return data;
}

const walletPath = process.env.ANCHOR_WALLET || `${homedir()}/.config/solana/id.json`;
const authority = Keypair.fromSecretKey(
  Uint8Array.from(JSON.parse(readFileSync(walletPath, "utf8")) as number[]),
);
const sessionSigner = Keypair.generate();
const [sessionToken] = PublicKey.findProgramAddressSync(
  [
    new TextEncoder().encode("session_token_v2"),
    PROGRAM_ID.toBytes(),
    sessionSigner.publicKey.toBytes(),
    authority.publicKey.toBytes(),
  ],
  SESSION_PROGRAM,
);

const baseConnection = new Connection(BASE_RPC, "confirmed");
const erConnection = new Connection(ER_RPC, "confirmed");
const validUntil = Math.floor(Date.now() / 1000) + 3600;

const createSession = new TransactionInstruction({
  programId: SESSION_PROGRAM,
  keys: [
    { pubkey: sessionToken, isSigner: false, isWritable: true },
    { pubkey: sessionSigner.publicKey, isSigner: true, isWritable: true },
    { pubkey: authority.publicKey, isSigner: true, isWritable: true },
    { pubkey: authority.publicKey, isSigner: true, isWritable: false },
    { pubkey: PROGRAM_ID, isSigner: false, isWritable: false },
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
  ],
  data: encodeCreateSession(validUntil) as Buffer,
});
const authorizationSignature = await sendAndConfirmTransaction(
  baseConnection,
  new Transaction().add(createSession),
  [authority, sessionSigner],
  { commitment: "confirmed" },
);
console.log(`Devnet authorization confirmed: ${authorizationSignature}`);

const recordInteraction = new TransactionInstruction({
  programId: PROGRAM_ID,
  keys: [
    { pubkey: sessionSigner.publicKey, isSigner: true, isWritable: true },
    { pubkey: WORLD_SESSION, isSigner: false, isWritable: true },
    { pubkey: authority.publicKey, isSigner: false, isWritable: false },
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    { pubkey: sessionToken, isSigner: false, isWritable: false },
  ],
  data: Uint8Array.from([...RECORD_SESSION_ENCOUNTER, 0]) as Buffer,
});
const latestBlockhash = await erConnection.getLatestBlockhash("confirmed");
const erTransaction = new Transaction({
  feePayer: sessionSigner.publicKey,
  blockhash: latestBlockhash.blockhash,
  lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
}).add(recordInteraction);
erTransaction.sign(sessionSigner);
const interactionSignature = await erConnection.sendRawTransaction(erTransaction.serialize());
await erConnection.confirmTransaction(
  { signature: interactionSignature, ...latestBlockhash },
  "confirmed",
);

console.log(JSON.stringify({
  authority: authority.publicKey.toBase58(),
  sessionSigner: sessionSigner.publicKey.toBase58(),
  sessionToken: sessionToken.toBase58(),
  authorizationSignature,
  interactionSignature,
  validUntil,
}, null, 2));
