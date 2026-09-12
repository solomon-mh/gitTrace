import type { Metadata } from "next";
import { Inter, Space_Grotesk, JetBrains_Mono } from "next/font/google";
import "./globals.css";

/**
 * Type system:
 *   - Space Grotesk  → the wordmark + card / section headings (geometric, a bit
 *     of character without being loud)
 *   - Inter          → body / UI text
 *   - JetBrains Mono  → numbers, repo names, branch names, anything tabular
 */
const sans = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});
const display = Space_Grotesk({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-display",
  display: "swap",
});
const mono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "gitStream — GitHub org health, at a glance",
  description:
    "One screen for org repo health: commit flow, PR age, stale branches, contributor concentration, issue velocity.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${sans.variable} ${display.variable} ${mono.variable}`}
    >
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
