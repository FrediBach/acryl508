import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  distDir: ".next-vercel",
  typescript: { tsconfigPath: "tsconfig.next.json" },
};

export default nextConfig;
