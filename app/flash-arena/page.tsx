import type { Metadata } from "next";
import { isDodoPaymentsEnabled } from "@/lib/payment-config";
import { ArenaWalletGate } from "./ArenaWalletGate";

export const metadata: Metadata = {
  title: "Explore",
  description: "Walk through BRUME World and discover products built to stand out.",
};

export default function FlashArenaPage() {
  return <ArenaWalletGate paymentsEnabled={isDodoPaymentsEnabled()} />;
}
