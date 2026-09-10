"use client";

import { DashboardProvider } from "./DashboardContext";
import { StatusBar } from "./StatusBar";
import { RepoSelector } from "./RepoSelector";
import { Logo } from "@/components/Logo";
import { CommitActivityCard } from "./cards/CommitActivityCard";
import { PrHealthCard } from "./cards/PrHealthCard";
import { StaleBranchesCard } from "./cards/StaleBranchesCard";
import { ContributorActivityCard } from "./cards/ContributorActivityCard";
import { IssueVelocityCard } from "./cards/IssueVelocityCard";

/**
 * The dashboard shell.
 *
 * Layout: a sticky control column (repo selector) on the left, and a grid of
 * metric cards on the right. Cards are added one per build step:
 *   step 3 — commit activity
 *   step 4 — PR health
 *   step 5 — stale branches
 *   step 6 — contributor activity
 *   step 7 — issue velocity
 */
export function Dashboard({ defaultOrg }: { defaultOrg?: string }) {
  return (
    <DashboardProvider defaultOrg={defaultOrg}>
      <div className="relative z-10 min-h-screen">
        <header className="sticky top-0 z-20 border-b border-border bg-canvas/70 backdrop-blur-md">
          <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
            <Logo />
            <span className="hidden text-xs text-ink-subtle sm:inline">
              GitHub organization health
            </span>
          </div>
        </header>

        <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6">
          <StatusBar />

          <div className="mt-4 grid gap-4 lg:grid-cols-[340px_minmax(0,1fr)]">
            <div className="lg:sticky lg:top-[68px] lg:self-start">
              <RepoSelector />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <CommitActivityCard />
              <PrHealthCard />
              <StaleBranchesCard />
              <ContributorActivityCard />
              <IssueVelocityCard />
            </div>
          </div>
        </div>
      </div>
    </DashboardProvider>
  );
}
