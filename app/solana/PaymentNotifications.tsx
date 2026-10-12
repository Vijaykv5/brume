"use client";

import type { PaymentReceipt } from "../world/useMultiplayer";
import { formatLamports } from "./format";
import { getExplorerUrl } from "./config";

export function PaymentNotifications({
  receipts,
  onDismiss,
}: {
  receipts: PaymentReceipt[];
  onDismiss: (signature: string) => void;
}) {
  if (receipts.length === 0) return null;

  return (
    <div className="payment-notifications" aria-label="Payment receipts">
      {receipts.map((receipt) => {
        const amount = formatLamports(receipt.lamports, "detailed");
        return (
          <section key={receipt.signature} role="status">
            <span className="payment-notification-icon" aria-hidden="true">✓</span>
            <div>
              <strong>Payment received</strong>
              <p>
                <span aria-label={amount.ariaLabel}>{amount.display} SOL</span> from{" "}
                {receipt.senderUsername}
              </p>
              <a
                href={getExplorerUrl("tx", receipt.signature)}
                target="_blank"
                rel="noreferrer"
              >
                View transaction ↗
              </a>
            </div>
            <button
              type="button"
              aria-label="Dismiss payment receipt"
              onClick={() => onDismiss(receipt.signature)}
            >
              ×
            </button>
          </section>
        );
      })}
    </div>
  );
}
