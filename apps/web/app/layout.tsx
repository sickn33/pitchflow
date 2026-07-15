import type { Metadata } from "next";
import type { ReactNode } from "react";

import "./styles.css";

const metadataBase = new URL(
  process.env.NEXT_PUBLIC_SITE_URL ??
    (process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : "http://localhost:3210"),
);

export const metadata: Metadata = {
  applicationName: "PitchFlow",
  description:
    "Turn a public GitHub repository into an evidence-grounded site, social system, motion promo, and launch copy with GPT-5.6 in Codex.",
  keywords: ["Codex", "GPT-5.6", "developer tools", "launch campaign", "GitHub"],
  metadataBase,
  openGraph: {
    description: "Evidence in. Launch system out. A repo-native AI launch studio for developers.",
    images: [
      {
        alt: "PitchFlow — evidence in, launch system out",
        height: 630,
        url: "/opengraph-image",
        width: 1200,
      },
    ],
    siteName: "PitchFlow",
    title: "PitchFlow · Repo-native AI launch studio",
    type: "website",
  },
  robots: { follow: true, index: true },
  title: { default: "PitchFlow · Repo-native AI launch studio", template: "%s · PitchFlow" },
  twitter: {
    card: "summary_large_image",
    description: "Evidence in. Launch system out. Built with Codex + GPT-5.6.",
    images: ["/opengraph-image"],
    title: "PitchFlow · Repo-native AI launch studio",
  },
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
