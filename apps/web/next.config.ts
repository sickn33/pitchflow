import type { NextConfig } from "next";
import { resolve } from "node:path";

const nextConfig: NextConfig = {
  headers() {
    return Promise.resolve([
      {
        source: "/:path*",
        headers: [
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
          },
        ],
      },
      {
        source: "/dogfood/pitchflow/v1/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
    ]);
  },
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
