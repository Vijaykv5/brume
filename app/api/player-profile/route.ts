import { NextResponse } from "next/server";
import { PublicKey } from "@solana/web3.js";
import nacl from "tweetnacl";
import { parsePlayerProfile } from "@/multiplayer/avatar-profile";
import { createPlayerProfileStore } from "@/lib/player-profiles";

const SIGN_IN_PREFIX = "BRUME World sign-in";
const MAX_SIGN_IN_AGE_MS = 5 * 60_000;

type ProfileRequest = {
  walletAddress?: unknown;
  message?: unknown;
  signature?: unknown;
  profile?: unknown;
};

function decodeSignature(value: string) {
  return Uint8Array.from(Buffer.from(value, "base64"));
}

function readIssuedAt(message: string) {
  const line = message
    .split("\n")
    .find((candidate) => candidate.startsWith("Issued at: "));
  if (!line) return null;
  const issuedAt = Date.parse(line.slice("Issued at: ".length));
  return Number.isFinite(issuedAt) ? issuedAt : null;
}

export async function POST(request: Request) {
  let body: ProfileRequest;
  try {
    body = (await request.json()) as ProfileRequest;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const profile = parsePlayerProfile(body.profile);
  if (
    typeof body.walletAddress !== "string" ||
    typeof body.message !== "string" ||
    typeof body.signature !== "string" ||
    !profile
  ) {
    return NextResponse.json({ error: "Invalid player profile request." }, { status: 400 });
  }

  try {
    const publicKey = new PublicKey(body.walletAddress);
    const walletAddress = publicKey.toBase58();
    const issuedAt = readIssuedAt(body.message);
    const now = Date.now();
    const validMessage =
      body.message.startsWith(`${SIGN_IN_PREFIX}\n`) &&
      body.message.includes(`Wallet: ${walletAddress}`) &&
      body.message.includes(`Explorer: ${profile.username}`) &&
      body.message.includes("Purpose: Enter the BRUME World arena") &&
      issuedAt !== null &&
      issuedAt <= now + 30_000 &&
      now - issuedAt <= MAX_SIGN_IN_AGE_MS;
    const signature = decodeSignature(body.signature);
    const verified =
      validMessage &&
      signature.length === nacl.sign.signatureLength &&
      nacl.sign.detached.verify(
        new TextEncoder().encode(body.message),
        signature,
        publicKey.toBytes(),
      );

    if (!verified) {
      return NextResponse.json(
        { error: "The wallet signature could not be verified." },
        { status: 401 },
      );
    }

    const store = createPlayerProfileStore();
    if (!store) {
      return NextResponse.json(
        { error: "Player profile storage is not configured." },
        { status: 503 },
      );
    }

    await store.set(walletAddress, profile);
    return NextResponse.json({ ok: true, walletAddress, profile });
  } catch (error) {
    console.error("Failed to persist BRUME player profile", error);
    return NextResponse.json(
      { error: "Your character could not be saved. Please try again." },
      { status: 500 },
    );
  }
}
