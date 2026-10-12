import type { Metadata } from "next";
import { SceneCanvas } from "../SceneCanvas";
import { isDodoPaymentsEnabled } from "@/lib/payment-config";

export const metadata: Metadata = {
  title: "Explore",
  description: "Walk through BRUME World and discover products built to stand out.",
};

export default function FlashArenaPage() {
  return (
    <main className="scene-shell" aria-label="BRUME World interactive city">
      <SceneCanvas paymentsEnabled={isDodoPaymentsEnabled()} />
    </main>
  );
}
