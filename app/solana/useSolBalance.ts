"use client";

import { useCallback, useEffect, useState } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";

export function useSolBalance() {
  const { connection } = useConnection();
  const { publicKey } = useWallet();
  const [balanceLamports, setBalanceLamports] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    if (!publicKey) return;
    setLoading(true);
    setError("");
    try {
      setBalanceLamports(await connection.getBalance(publicKey, "confirmed"));
    } catch {
      setError("Couldn’t load balance.");
    } finally {
      setLoading(false);
    }
  }, [connection, publicKey]);

  useEffect(() => {
    if (!publicKey) return;

    let disposed = false;
    connection
      .getBalance(publicKey, "confirmed")
      .then((balance) => {
        if (!disposed) {
          setBalanceLamports(balance);
          setError("");
        }
      })
      .catch(() => {
        if (!disposed) setError("Couldn’t load balance.");
      })
      .finally(() => {
        if (!disposed) setLoading(false);
      });
    const subscription = connection.onAccountChange(
      publicKey,
      (account) => {
        if (!disposed) setBalanceLamports(account.lamports);
      },
      "confirmed",
    );

    return () => {
      disposed = true;
      void connection.removeAccountChangeListener(subscription);
    };
  }, [connection, publicKey, refresh]);

  return { balanceLamports, loading, error, refresh };
}
