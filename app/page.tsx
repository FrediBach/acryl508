import type { Metadata } from "next";
import { ConfiguratorShell } from "@/components/configurator-shell";

export const metadata: Metadata = {
  title: "Acrylic Eurorack Case Creator",
  description:
    "Configure an acrylic Eurorack case in real time and prepare it for fabrication.",
};

export default function Home() {
  return <ConfiguratorShell />;
}
