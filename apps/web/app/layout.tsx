import type { Metadata } from "next";
import type { ReactNode } from "react";

import { resolveMetadataBase } from "../lib/site-url";
import "./styles.css";

const metadataBase = resolveMetadataBase();

export const metadata: Metadata = {
  applicationName: "PitchFlow",
  description:
    "Turn a GitHub repository into a launch website, social images, product videos, and ready-to-post copy with GPT-5.6 through local Codex.",
  keywords: ["Codex", "GPT-5.6", "developer tools", "launch campaign", "GitHub"],
  metadataBase,
  openGraph: {
    description:
      "PitchFlow uses repository evidence and real product screenshots to create a website, social images, videos, and copy with GPT-5.6 through local Codex.",
    images: [
      {
        alt: "PitchFlow turns a GitHub repository into a website, social images, videos, and copy",
        height: 630,
        url: "/opengraph-image",
        width: 1200,
      },
    ],
    siteName: "PitchFlow",
    title: "PitchFlow · Repository to marketing assets",
    type: "website",
  },
  robots: { follow: true, index: true },
  title: { default: "PitchFlow · Repository to marketing assets", template: "%s · PitchFlow" },
  twitter: {
    card: "summary_large_image",
    description:
      "Turn a GitHub repository into a website, social images, product videos, and ready-to-post copy with GPT-5.6 through local Codex.",
    images: ["/opengraph-image"],
    title: "PitchFlow · Repository to marketing assets",
  },
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
