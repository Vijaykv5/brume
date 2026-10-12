"use client";

import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
} from "@solana/web3.js";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  MAGICBLOCK_DELEGATION_PROGRAM,
  MAGICBLOCK_DEPLOYMENT,
  MAGICBLOCK_ER_RPC,
  MAGICBLOCK_SESSION_PROGRAM,
} from "./magicblockDeployment";

const CREATE_SESSION_V2_DISCRIMINATOR = Uint8Array.from([
  223, 233, 108, 7, 65, 194, 235, 38,
]);
const RECORD_SESSION_INTERACTION_DISCRIMINATOR = Uint8Array.from([
  179, 61, 115, 125, 220, 212, 219, 218,
]);
const RECORD_SESSION_ENCOUNTER_DISCRIMINATOR = Uint8Array.from([
  232, 178, 131, 146, 212, 251, 164, 95,
]);
const PLAYER_INTERACTION_VARIANT = 0;
const SESSION_TOKEN_SEED = new TextEncoder().encode("session_token_v2");
const SESSION_DURATION_SECONDS = 60 * 60;

type ActiveSession = {
  signer: Keypair;
  token: PublicKey;
  authority: PublicKey;
  expiresAt: number;
};

export type MagicBlockLiveState = "checking" | "live" | "offline";
export type MagicBlockTransactionState =
  | "idle"
  | "authorizing"
  | "sending"
  | "confirming"
  | "confirmed"
  | "failed";
export type MagicBlockEncounterResult =
  | "high_five"
  | "rps_win"
  | "rps_loss"
  | "rps_draw";

const ENCOUNTER_RESULT_VARIANTS: Record<MagicBlockEncounterResult, number> = {
  high_five: 0,
  rps_win: 1,
  rps_loss: 2,
  rps_draw: 3,
};

function decodeInteractionCount(data: Uint8Array) {
  const offset = 8 + 32 + 16 + 1;
  if (data.byteLength < offset + 8) return null;
  return Number(new DataView(data.buffer, data.byteOffset, data.byteLength).getBigUint64(offset, true));
}

function encodeCreateSessionV2(validUntil: number) {
  // Anchor/Borsh: three Option<T> values — Some(false), Some(i64), Some(0u64).
  const data = new Uint8Array(8 + 2 + 9 + 9);
  data.set(CREATE_SESSION_V2_DISCRIMINATOR, 0);
  data[8] = 1;
  data[9] = 0;
  data[10] = 1;
  const view = new DataView(data.buffer);
  view.setBigInt64(11, BigInt(validUntil), true);
  data[19] = 1;
  view.setBigUint64(20, BigInt(0), true);
  return data;
}

function readableError(error: unknown) {
  if (error instanceof Error) {
    const message = error.message;
    if (/user rejected|declined/i.test(message)) return "Wallet authorization was cancelled.";
    if (/insufficient/i.test(message)) return "This wallet needs a small amount of devnet SOL for session rent.";
    if (/blockhash|network mismatch/i.test(message)) {
      return "The wallet network does not match Solana devnet. Switch the wallet to devnet and retry.";
    }
    return message.slice(0, 180);
  }
  return "The MagicBlock interaction could not be completed.";
}

export function useMagicBlockWorldSession() {
  const { connection: baseConnection } = useConnection();
  const { connected, publicKey, sendTransaction } = useWallet();
  const erConnection = useMemo(
    () => new Connection(MAGICBLOCK_ER_RPC, "confirmed"),
    [],
  );
  const mountedRef = useRef(true);
  const sessionRef = useRef<ActiveSession | null>(null);
  const walletAddress = publicKey?.toBase58() ?? null;
  const [liveState, setLiveState] = useState<MagicBlockLiveState>("checking");
  const [transactionState, setTransactionState] =
    useState<MagicBlockTransactionState>("idle");
  const [interactionCount, setInteractionCount] = useState<number | null>(null);
  const [lastSignature, setLastSignature] = useState<string | null>(null);
  const [authorizationSignature, setAuthorizationSignature] = useState<string | null>(null);
  const [sessionSignerAddress, setSessionSignerAddress] = useState<string | null>(null);
  const [sessionTokenAddress, setSessionTokenAddress] = useState<string | null>(null);
  const [sessionExpiresAt, setSessionExpiresAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLiveState("checking");
    try {
      const worldSession = new PublicKey(MAGICBLOCK_DEPLOYMENT.worldSessionPda);
      const [baseAccount, erAccount] = await Promise.all([
        baseConnection.getAccountInfo(worldSession, "confirmed"),
        erConnection.getAccountInfo(worldSession, "confirmed"),
      ]);
      const delegated = baseAccount?.owner.equals(
        new PublicKey(MAGICBLOCK_DELEGATION_PROGRAM),
      );
      if (!mountedRef.current) return;
      setLiveState(delegated && Boolean(erAccount?.data.length) ? "live" : "offline");
      setInteractionCount(erAccount ? decodeInteractionCount(erAccount.data) : null);
      setError(null);
    } catch (cause) {
      if (!mountedRef.current) return;
      setLiveState("offline");
      setError(readableError(cause));
    }
  }, [baseConnection, erConnection]);

  useEffect(() => {
    mountedRef.current = true;
    const refreshTimer = window.setTimeout(() => void refresh(), 0);
    return () => {
      window.clearTimeout(refreshTimer);
      mountedRef.current = false;
    };
  }, [refresh]);

  useEffect(() => {
    const active = sessionRef.current;
    if (active && active.authority.toBase58() === walletAddress) return;
    sessionRef.current = null;
    setAuthorizationSignature(null);
    setSessionSignerAddress(null);
    setSessionTokenAddress(null);
    setSessionExpiresAt(null);
    setTransactionState("idle");
  }, [walletAddress]);

  const authorizeSession = useCallback(async () => {
    if (!connected || !publicKey) throw new Error("Connect a wallet before authorizing a session.");

    const existing = sessionRef.current;
    const now = Math.floor(Date.now() / 1000);
    if (
      existing &&
      existing.authority.equals(publicKey) &&
      existing.expiresAt > now + 30
    ) {
      return existing;
    }

    setTransactionState("authorizing");
    const signer = Keypair.generate();
    const programId = new PublicKey(MAGICBLOCK_DEPLOYMENT.programId);
    const sessionProgram = new PublicKey(MAGICBLOCK_SESSION_PROGRAM);
    const [token] = PublicKey.findProgramAddressSync(
      [SESSION_TOKEN_SEED, programId.toBytes(), signer.publicKey.toBytes(), publicKey.toBytes()],
      sessionProgram,
    );
    const expiresAt = now + SESSION_DURATION_SECONDS;
    const instruction = new TransactionInstruction({
      programId: sessionProgram,
      keys: [
        { pubkey: token, isSigner: false, isWritable: true },
        { pubkey: signer.publicKey, isSigner: true, isWritable: true },
        { pubkey: publicKey, isSigner: true, isWritable: true },
        { pubkey: publicKey, isSigner: true, isWritable: false },
        { pubkey: programId, isSigner: false, isWritable: false },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ],
      data: encodeCreateSessionV2(expiresAt) as Buffer,
    });
    const transaction = new Transaction().add(instruction);
    const signature = await sendTransaction(transaction, baseConnection, {
      signers: [signer],
      preflightCommitment: "confirmed",
    });
    setAuthorizationSignature(signature);
    await baseConnection.confirmTransaction(signature, "confirmed");

    const session = { signer, token, authority: publicKey, expiresAt };
    sessionRef.current = session;
    if (mountedRef.current) {
      setSessionSignerAddress(signer.publicKey.toBase58());
      setSessionTokenAddress(token.toBase58());
      setSessionExpiresAt(expiresAt);
    }
    return session;
  }, [baseConnection, connected, publicKey, sendTransaction]);

  const recordPlayerInteraction = useCallback(async () => {
    if (!connected || !publicKey) {
      setTransactionState("failed");
      setError("Connect a wallet before recording an interaction.");
      return null;
    }

    setError(null);
    try {
      const session = await authorizeSession();
      if (!mountedRef.current) return null;
      setTransactionState("sending");

      const worldSession = new PublicKey(MAGICBLOCK_DEPLOYMENT.worldSessionPda);
      const programId = new PublicKey(MAGICBLOCK_DEPLOYMENT.programId);
      const instruction = new TransactionInstruction({
        programId,
        keys: [
          { pubkey: session.signer.publicKey, isSigner: true, isWritable: true },
          { pubkey: worldSession, isSigner: false, isWritable: true },
          { pubkey: publicKey, isSigner: false, isWritable: false },
          { pubkey: session.token, isSigner: false, isWritable: false },
        ],
        data: Uint8Array.from([
          ...RECORD_SESSION_INTERACTION_DISCRIMINATOR,
          PLAYER_INTERACTION_VARIANT,
        ]) as Buffer,
      });
      const latestBlockhash = await erConnection.getLatestBlockhash("confirmed");
      const transaction = new Transaction({
        feePayer: session.signer.publicKey,
        blockhash: latestBlockhash.blockhash,
        lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
      }).add(instruction);
      transaction.sign(session.signer);
      const signature = await erConnection.sendRawTransaction(transaction.serialize(), {
        skipPreflight: false,
      });
      if (!mountedRef.current) return signature;
      setLastSignature(signature);
      setTransactionState("confirming");
      await erConnection.confirmTransaction(
        { signature, ...latestBlockhash },
        "confirmed",
      );
      const account = await erConnection.getAccountInfo(worldSession, "confirmed");
      if (!mountedRef.current) return signature;
      setInteractionCount(account ? decodeInteractionCount(account.data) : null);
      setTransactionState("confirmed");
      setLiveState("live");
      return signature;
    } catch (cause) {
      if (!mountedRef.current) return null;
      setTransactionState("failed");
      setError(readableError(cause));
      return null;
    }
  }, [authorizeSession, connected, erConnection, publicKey]);

  const prepareSession = useCallback(async () => {
    setError(null);
    try {
      await authorizeSession();
      if (mountedRef.current) setTransactionState("idle");
      return true;
    } catch (cause) {
      if (mountedRef.current) {
        setTransactionState("failed");
        setError(readableError(cause));
      }
      return false;
    }
  }, [authorizeSession]);

  const recordEncounter = useCallback(async (
    targetWalletAddress: string,
    result: MagicBlockEncounterResult,
  ) => {
    if (!connected || !publicKey) {
      setTransactionState("failed");
      setError("Connect a wallet before settling an encounter.");
      return null;
    }

    setError(null);
    try {
      const target = new PublicKey(targetWalletAddress);
      if (target.equals(publicKey)) throw new Error("An encounter requires two different wallets.");
      const session = await authorizeSession();
      if (!mountedRef.current) return null;
      setTransactionState("sending");

      const worldSession = new PublicKey(MAGICBLOCK_DEPLOYMENT.worldSessionPda);
      const programId = new PublicKey(MAGICBLOCK_DEPLOYMENT.programId);
      const instruction = new TransactionInstruction({
        programId,
        keys: [
          { pubkey: session.signer.publicKey, isSigner: true, isWritable: true },
          { pubkey: worldSession, isSigner: false, isWritable: true },
          { pubkey: publicKey, isSigner: false, isWritable: false },
          { pubkey: target, isSigner: false, isWritable: false },
          { pubkey: session.token, isSigner: false, isWritable: false },
        ],
        data: Uint8Array.from([
          ...RECORD_SESSION_ENCOUNTER_DISCRIMINATOR,
          ENCOUNTER_RESULT_VARIANTS[result],
        ]) as Buffer,
      });
      const latestBlockhash = await erConnection.getLatestBlockhash("confirmed");
      const transaction = new Transaction({
        feePayer: session.signer.publicKey,
        blockhash: latestBlockhash.blockhash,
        lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
      }).add(instruction);
      transaction.sign(session.signer);
      const signature = await erConnection.sendRawTransaction(transaction.serialize(), {
        skipPreflight: false,
      });
      if (!mountedRef.current) return signature;
      setLastSignature(signature);
      setTransactionState("confirming");
      await erConnection.confirmTransaction(
        { signature, ...latestBlockhash },
        "confirmed",
      );
      const account = await erConnection.getAccountInfo(worldSession, "confirmed");
      if (!mountedRef.current) return signature;
      setInteractionCount(account ? decodeInteractionCount(account.data) : null);
      setTransactionState("confirmed");
      setLiveState("live");
      return signature;
    } catch (cause) {
      if (!mountedRef.current) return null;
      setTransactionState("failed");
      setError(readableError(cause));
      return null;
    }
  }, [authorizeSession, connected, erConnection, publicKey]);

  return {
    liveState,
    transactionState,
    interactionCount,
    lastSignature,
    authorizationSignature,
    sessionSignerAddress,
    sessionTokenAddress,
    sessionExpiresAt,
    error,
    refresh,
    authorizeSession,
    prepareSession,
    recordPlayerInteraction,
    recordEncounter,
  };
}
