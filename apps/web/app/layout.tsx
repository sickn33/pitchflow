import type { Metadata } from "next";
import type { ReactNode } from "react";

import { resolveMetadataBase } from "../lib/site-url";
import "./styles.css";

const metadataBase = resolveMetadataBase();

export const metadata: Metadata = {
  applicationName: "PitchFlow",
  description:
    "Turn a public GitHub repository into an evidence-grounded site, social system, motion promo, and launch copy with GPT-5.6 in Codex.",
  keywords: ["Codex", "GPT-5.6", "developer tools", "launch campaign", "GitHub"],
  metadataBase,
  openGraph: {
    description:
      "Paste a public GitHub repository. Get a launch-ready site, social kit, product video, and channel copy directed with GPT-5.6 in Codex.",
    images: [
      {
        alt: "PitchFlow turns a repository into a complete launch campaign",
        height: 630,
        url: "/opengraph-image",
        width: 1200,
      },
    ],
    siteName: "PitchFlow",
    title: "PitchFlow · Your repo, launch-ready",
    type: "website",
  },
  robots: { follow: true, index: true },
  title: { default: "PitchFlow · Your repo, launch-ready", template: "%s · PitchFlow" },
  twitter: {
    card: "summary_large_image",
    description:
      "Turn a public GitHub repository into a launch-ready site, social kit, product video, and copy with GPT-5.6 in Codex.",
    images: ["/opengraph-image"],
    title: "PitchFlow · Your repo, launch-ready",
  },
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
