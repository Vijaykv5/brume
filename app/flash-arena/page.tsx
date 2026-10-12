import type { Metadata } from "next";
import { ArenaWalletGate } from "./ArenaWalletGate";

export const metadata: Metadata = {
  title: "Explore",
  description: "Walk through BRUME World and discover products built to stand out.",
};

export default function FlashArenaPage() {
  return <ArenaWalletGate />;
}
