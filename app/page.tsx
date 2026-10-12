import type { Metadata } from "next";
import LandingPage from "./LandingPage";

export const metadata: Metadata = {
  title: { absolute: "BRUME World — Wander into the internet" },
  description:
    "Walk the streets, discover projects, and build your corner of BRUME World.",
};

export default function Home() {
  return <LandingPage />;
}
