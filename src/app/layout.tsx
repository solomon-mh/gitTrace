import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "GitStream — GitHub Org Health Dashboard",
  description:
    "Single-page view of repo health across a GitHub organization: commits, PR age, stale branches, contributors, issue velocity.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
