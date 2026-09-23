import type { Metadata } from "next";
import { ConfiguratorShell } from "@/components/configurator-shell";

export const metadata: Metadata = {
  title: "Acrylic Eurorack Case Creator",
  description:
    "Configure a GS acrylic Eurorack case in real time. Explore dimensions, colours and construction, then export your design specification.",
};

export default function Home() {
  return <ConfiguratorShell />;
}
