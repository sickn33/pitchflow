import type { NextConfig } from "next";
import { resolve } from "node:path";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  outputFileTracingExcludes: {
    "/api/export": [
      "../../artifacts/**",
      "../../packages/export/**",
      "../../packages/remotion/**",
      "../../scripts/**",
    ],
  },
  turbopack: {
    root: resolve(import.meta.dirname, "../.."),
  },
  transpilePackages: ["@pitchflow/core", "@pitchflow/codex", "@pitchflow/remotion"],
};

export default nextConfig;
