import type { Metadata } from "next";
import { Inter, Chakra_Petch, JetBrains_Mono } from "next/font/google";
import "./globals.css";

/**
 * Type system:
 *   - Chakra Petch   → the wordmark + card / section headings (angular,
 *     cut-corner technical face — reads like a label on a schematic or a
 *     traced signal path, not a generic rounded-geometric sans)
 *   - Inter          → body / UI text
 *   - JetBrains Mono  → numbers, repo names, branch names, anything tabular
 */
const sans = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});
const display = Chakra_Petch({
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
  title: "gitTrace — GitHub org health, at a glance",
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
