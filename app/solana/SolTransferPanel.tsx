"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import {
  ACCOUNT_SIZE,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountIdempotentInstruction,
  createTransferCheckedInstruction,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import {
  PublicKey,
  SystemProgram,
  Transaction,
  type BlockhashWithExpiryBlockHeight,
} from "@solana/web3.js";
import type { NetworkPlayer } from "@/multiplayer/protocol";
import { formatLamports, parseSolAmount } from "./format";
import {
  getExplorerUrl,
  shortenWalletAddress,
  SOLANA_NETWORK_LABEL,
} from "./config";
import { useSolBalance } from "./useSolBalance";

type PreparedTransfer = {
  transaction: Transaction;
  blockhash: BlockhashWithExpiryBlockHeight;
  feeLamports: number;
  recipientAccountCreationLamports: number;
  asset: TransferAsset;
  amountBaseUnits: bigint;
  amountDisplay: string;
};

type TransferStage = "amount" | "review" | "signing" | "confirmed" | "failed";

type WalletToken = {
  account: PublicKey;
  mint: PublicKey;
  programId: PublicKey;
  decimals: number;
  amount: bigint;
  balanceDisplay: string;
};

type TransferAsset =
  | { kind: "sol" }
  | { kind: "token"; token: WalletToken };

function parseTokenAmount(value: string, decimals: number) {
  const normalized = value.trim();
  if (!/^(?:\d+)(?:\.\d*)?$/.test(normalized)) return null;
  const [whole, fraction = ""] = normalized.split(".");
  if (fraction.length > decimals) return null;
  const paddedFraction = fraction.padEnd(decimals, "0");
  const baseUnits = BigInt(`${whole}${paddedFraction}` || "0");
  return baseUnits > BigInt(0) ? baseUnits : null;
}

function tokenLabel(token: WalletToken) {
  const mint = token.mint.toBase58();
  return `Token ${mint.slice(0, 4)}…${mint.slice(-4)}`;
}

export function SolTransferPanel({
  recipient,
  onClose,
  onConfirmed,
}: {
  recipient: NetworkPlayer | null;
  onClose: () => void;
  onConfirmed: (receipt: {
    signature: string;
    recipientWallet: string;
    lamports: number;
  }) => void;
}) {
  const { connection } = useConnection();
  const { publicKey, sendTransaction } = useWallet();
  const { balanceLamports, refresh } = useSolBalance();
  const panelRef = useRef<HTMLElement>(null);
  const amountInputRef = useRef<HTMLInputElement>(null);
  const [amount, setAmount] = useState("");
  const [amountError, setAmountError] = useState("");
  const [stage, setStage] = useState<TransferStage>("amount");
  const [prepared, setPrepared] = useState<PreparedTransfer | null>(null);
  const [signature, setSignature] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [assetKind, setAssetKind] = useState<"sol" | "token">("sol");
  const [tokens, setTokens] = useState<WalletToken[]>([]);
  const [selectedTokenAccount, setSelectedTokenAccount] = useState("");
  const [tokensLoading, setTokensLoading] = useState(false);
  const [tokensError, setTokensError] = useState("");

  const loadTokens = useCallback(async () => {
    if (!publicKey) return;
    setTokensLoading(true);
    setTokensError("");
    try {
      const responses = await Promise.all([
        connection.getParsedTokenAccountsByOwner(publicKey, { programId: TOKEN_PROGRAM_ID }, "confirmed"),
        connection.getParsedTokenAccountsByOwner(publicKey, { programId: TOKEN_2022_PROGRAM_ID }, "confirmed"),
      ]);
      const nextTokens = responses.flatMap((response) =>
        response.value.flatMap(({ pubkey, account }) => {
          const parsed = account.data;
          if (!("parsed" in parsed)) return [];
          const info = parsed.parsed?.info as
            | { mint?: string; tokenAmount?: { amount?: string; decimals?: number; uiAmountString?: string } }
            | undefined;
          const mint = info?.mint;
          const rawAmount = info?.tokenAmount?.amount;
          const decimals = info?.tokenAmount?.decimals;
          if (!mint || !rawAmount || typeof decimals !== "number" || BigInt(rawAmount) <= BigInt(0)) return [];
          return [{
            account: pubkey,
            mint: new PublicKey(mint),
            programId: account.owner,
            decimals,
            amount: BigInt(rawAmount),
            balanceDisplay: info?.tokenAmount?.uiAmountString ?? rawAmount,
          } satisfies WalletToken];
        }),
      );
      nextTokens.sort((first, second) => first.mint.toBase58().localeCompare(second.mint.toBase58()));
      setTokens(nextTokens);
      setSelectedTokenAccount((current) =>
        nextTokens.some((token) => token.account.toBase58() === current)
          ? current
          : (nextTokens[0]?.account.toBase58() ?? ""),
      );
    } catch {
      setTokensError("Couldn’t load the assets in your wallet. Check the RPC connection and retry.");
    } finally {
      setTokensLoading(false);
    }
  }, [connection, publicKey]);

  useEffect(() => {
    if (!recipient || !publicKey) return;
    const timer = window.setTimeout(() => void loadTokens(), 0);
    return () => window.clearTimeout(timer);
  }, [loadTokens, publicKey, recipient]);

  useEffect(() => {
    if (!recipient) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && stage !== "signing") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab" || !panelRef.current) return;
      const focusable = Array.from(
        panelRef.current.querySelectorAll<HTMLElement>(
          "a[href], input:not([disabled]), button:not([disabled])",
        ),
      );
      const first = focusable[0];
      const last = focusable.at(-1);
      if (!first || !last) return;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    amountInputRef.current?.focus();
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      previouslyFocused?.focus();
    };
  }, [onClose, recipient, stage]);

  if (!recipient?.walletAddress || !publicKey) return null;

  const recipientWallet = recipient.walletAddress;
  const selectedToken =
    tokens.find((token) => token.account.toBase58() === selectedTokenAccount) ?? null;
  const transferAmount = prepared?.asset.kind === "sol"
    ? formatLamports(Number(prepared.amountBaseUnits), "detailed")
    : null;
  const feeAmount = prepared
    ? formatLamports(prepared.feeLamports, "detailed")
    : null;
  const totalNetworkCost = prepared
    ? formatLamports(prepared.feeLamports + prepared.recipientAccountCreationLamports, "detailed")
    : null;

  const prepareTransfer = async () => {
    const token = assetKind === "token" ? selectedToken : null;
    const amountBaseUnits = token
      ? parseTokenAmount(amount, token.decimals)
      : BigInt(parseSolAmount(amount) ?? 0);
    if (!amountBaseUnits) {
      setAmountError(
        token
          ? `Enter a valid amount with up to ${token.decimals} decimal places.`
          : "Enter a valid SOL amount with up to 9 decimal places.",
      );
      amountInputRef.current?.focus();
      return;
    }
    if (token && amountBaseUnits > token.amount) {
      setAmountError("That amount is higher than this token account’s balance.");
      return;
    }

    setAmountError("");
    setStatusMessage("Preparing transaction…");
    try {
      const blockhash = await connection.getLatestBlockhash("confirmed");
      const transaction = new Transaction({
        feePayer: publicKey,
        recentBlockhash: blockhash.blockhash,
      });
      let recipientAccountCreationLamports = 0;
      let asset: TransferAsset = { kind: "sol" };
      if (token) {
        const recipientPublicKey = new PublicKey(recipientWallet);
        const recipientTokenAccount = getAssociatedTokenAddressSync(
          token.mint,
          recipientPublicKey,
          false,
          token.programId,
          ASSOCIATED_TOKEN_PROGRAM_ID,
        );
        const recipientAccount = await connection.getAccountInfo(recipientTokenAccount, "confirmed");
        if (!recipientAccount) {
          recipientAccountCreationLamports = await connection.getMinimumBalanceForRentExemption(ACCOUNT_SIZE);
        }
        transaction.add(
          createAssociatedTokenAccountIdempotentInstruction(
            publicKey,
            recipientTokenAccount,
            recipientPublicKey,
            token.mint,
            token.programId,
            ASSOCIATED_TOKEN_PROGRAM_ID,
          ),
          createTransferCheckedInstruction(
            token.account,
            token.mint,
            recipientTokenAccount,
            publicKey,
            amountBaseUnits,
            token.decimals,
            [],
            token.programId,
          ),
        );
        asset = { kind: "token", token };
      } else {
        transaction.add(SystemProgram.transfer({
          fromPubkey: publicKey,
          toPubkey: new PublicKey(recipientWallet),
          lamports: Number(amountBaseUnits),
        }));
      }
      const feeLamports =
        (await connection.getFeeForMessage(transaction.compileMessage(), "confirmed"))
          .value ?? 0;
      const solRequired =
        feeLamports +
        recipientAccountCreationLamports +
        (asset.kind === "sol" ? Number(amountBaseUnits) : 0);
      if (balanceLamports != null && solRequired > balanceLamports) {
        setAmountError("Your wallet does not have enough SOL for the transfer and network costs.");
        setStatusMessage("");
        return;
      }
      setPrepared({
        transaction,
        blockhash,
        feeLamports,
        recipientAccountCreationLamports,
        asset,
        amountBaseUnits,
        amountDisplay: amount.trim(),
      });
      setStage("review");
      setStatusMessage("");
    } catch {
      setAmountError("Couldn’t prepare the transfer. Check your connection and try again.");
      setStatusMessage("");
    }
  };

  const submitTransfer = async () => {
    if (!prepared) return;
    setStage("signing");
    setStatusMessage("Approve the transfer in your wallet…");
    try {
      const nextSignature = await sendTransaction(prepared.transaction, connection, {
        preflightCommitment: "confirmed",
      });
      setSignature(nextSignature);
      setStatusMessage("Confirming on Solana…");
      const confirmation = await connection.confirmTransaction(
        { signature: nextSignature, ...prepared.blockhash },
        "confirmed",
      );
      if (confirmation.value.err) throw new Error("Solana rejected the transaction.");

      setStage("confirmed");
      setStatusMessage("Transfer confirmed.");
      if (prepared.asset.kind === "sol") {
        onConfirmed({
          signature: nextSignature,
          recipientWallet,
          lamports: Number(prepared.amountBaseUnits),
        });
      }
      void refresh();
    } catch (error) {
      setStage("failed");
      const message = error instanceof Error ? error.message : "Transfer failed.";
      setStatusMessage(
        /reject|cancel/i.test(message)
          ? "The signature request was cancelled. No SOL was sent."
          : "The transfer could not be confirmed. Your wallet was not charged unless Solana shows a confirmed transaction.",
      );
    }
  };

  return (
    <section
      ref={panelRef}
      className="sol-transfer-panel"
      role="dialog"
      aria-modal="true"
      aria-labelledby="sol-transfer-title"
      aria-busy={stage === "signing"}
    >
      <div className="sol-transfer-header">
        <div>
          <p>Wallet-to-wallet · {SOLANA_NETWORK_LABEL}</p>
          <h2 id="sol-transfer-title">Send to {recipient.username}</h2>
        </div>
        <button
          type="button"
          aria-label="Close SOL transfer"
          disabled={stage === "signing"}
          onClick={onClose}
        >
          ×
        </button>
      </div>

      <div className="sol-transfer-recipient">
        <span>Connected wallet</span>
        <button
          type="button"
          title={recipientWallet}
          onClick={() => void navigator.clipboard.writeText(recipientWallet)}
        >
          {shortenWalletAddress(recipientWallet)} · Copy
        </button>
      </div>

      {stage === "amount" && (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void prepareTransfer();
          }}
        >
          <div className="sol-transfer-tabs" aria-label="Asset type">
            <button
              type="button"
              aria-pressed={assetKind === "sol"}
              onClick={() => { setAssetKind("sol"); setAmount(""); setAmountError(""); }}
            >SOL</button>
            <button
              type="button"
              aria-pressed={assetKind === "token"}
              onClick={() => { setAssetKind("token"); setAmount(""); setAmountError(""); }}
            >Token or collectible</button>
          </div>
          {assetKind === "token" && (
            <div className="sol-transfer-asset-picker">
              <label htmlFor="sol-transfer-asset">Asset</label>
              {tokensLoading ? (
                <p role="status">Loading wallet assets…</p>
              ) : tokensError ? (
                <p className="sol-transfer-error" role="alert">{tokensError}</p>
              ) : tokens.length ? (
                <select
                  id="sol-transfer-asset"
                  value={selectedTokenAccount}
                  onChange={(event) => setSelectedTokenAccount(event.target.value)}
                >
                  {tokens.map((token) => (
                    <option key={token.account.toBase58()} value={token.account.toBase58()}>
                      {tokenLabel(token)} · {token.balanceDisplay}
                    </option>
                  ))}
                </select>
              ) : (
                <p>No transferable SPL assets were found in this wallet.</p>
              )}
              {selectedToken && (
                <small title={selectedToken.mint.toBase58()}>
                  Mint {shortenWalletAddress(selectedToken.mint.toBase58())} · Balance {selectedToken.balanceDisplay}
                </small>
              )}
            </div>
          )}
          <label htmlFor="sol-transfer-amount">Amount</label>
          <div className="sol-transfer-amount-field">
            <input
              ref={amountInputRef}
              id="sol-transfer-amount"
              name="sol-transfer-amount"
              type="text"
              inputMode="decimal"
              autoComplete="off"
              placeholder={assetKind === "sol" ? "0.01" : selectedToken?.decimals === 0 ? "1" : "1.0"}
              value={amount}
              aria-invalid={Boolean(amountError)}
              aria-describedby={amountError ? "sol-transfer-error" : "sol-transfer-hint"}
              onChange={(event) => {
                setAmount(event.target.value);
                if (amountError) setAmountError("");
              }}
            />
            <span>{assetKind === "sol" ? "SOL" : "TOKEN"}</span>
          </div>
          {amountError ? (
            <p id="sol-transfer-error" className="sol-transfer-error" role="alert">
              {amountError}
            </p>
          ) : (
            <p id="sol-transfer-hint" className="sol-transfer-hint">
              You’ll review the exact amount and network fee before signing.
            </p>
          )}
          <button
            type="submit"
            className="sol-transfer-primary"
            disabled={Boolean(statusMessage) || (assetKind === "token" && !selectedToken)}
          >
            {statusMessage || "Review transfer"}
          </button>
        </form>
      )}

      {stage === "review" && prepared && feeAmount && totalNetworkCost && (
        <div className="sol-transfer-review">
          <dl>
            <div>
              <dt>Send</dt>
              <dd aria-label={transferAmount?.ariaLabel}>
                {prepared.amountDisplay} {prepared.asset.kind === "sol" ? "SOL" : tokenLabel(prepared.asset.token)}
              </dd>
            </div>
            <div><dt>Network fee</dt><dd aria-label={feeAmount.ariaLabel}>{feeAmount.display} SOL</dd></div>
            {prepared.recipientAccountCreationLamports > 0 && (
              <div><dt>Recipient token account</dt><dd>up to {formatLamports(prepared.recipientAccountCreationLamports, "detailed").display} SOL</dd></div>
            )}
            <div className="is-total"><dt>Network cost</dt><dd aria-label={totalNetworkCost.ariaLabel}>{totalNetworkCost.display} SOL</dd></div>
          </dl>
          <p>Your wallet will ask you to approve one Solana transfer.</p>
          <div className="sol-transfer-actions">
            <button type="button" onClick={() => setStage("amount")}>Back</button>
            <button type="button" className="sol-transfer-primary" onClick={() => void submitTransfer()}>
              Confirm in wallet
            </button>
          </div>
        </div>
      )}

      {stage === "signing" && (
        <div className="sol-transfer-state" role="status">
          <span className="sol-transfer-spinner" aria-hidden="true" />
          <h3>Transfer in progress</h3>
          <p>{statusMessage}</p>
          {signature && (
            <a href={getExplorerUrl("tx", signature)} target="_blank" rel="noreferrer">
              Track on Solana Explorer ↗
            </a>
          )}
        </div>
      )}

      {stage === "confirmed" && prepared && (
        <div className="sol-transfer-state is-success" role="status">
          <span aria-hidden="true">✓</span>
          <h3>Payment confirmed</h3>
          <p>
            {prepared.amountDisplay} {prepared.asset.kind === "sol" ? "SOL" : tokenLabel(prepared.asset.token)} reached {recipient.username}.
          </p>
          <a href={getExplorerUrl("tx", signature)} target="_blank" rel="noreferrer">
            View transaction ↗
          </a>
          <button type="button" className="sol-transfer-primary" onClick={onClose}>Done</button>
        </div>
      )}

      {stage === "failed" && (
        <div className="sol-transfer-state is-error" role="alert">
          <span aria-hidden="true">!</span>
          <h3>Transfer not completed</h3>
          <p>{statusMessage}</p>
          <div className="sol-transfer-actions">
            <button type="button" onClick={onClose}>Close</button>
            <button
              type="button"
              className="sol-transfer-primary"
              onClick={() => {
                setPrepared(null);
                setSignature("");
                setStatusMessage("");
                setStage("amount");
              }}
            >
              Try again
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
