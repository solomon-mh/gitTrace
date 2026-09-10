"use client";

import { DashboardProvider } from "./DashboardContext";
import { StatusBar } from "./StatusBar";
import { RepoSelector } from "./RepoSelector";
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
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        <header className="mb-4 flex items-baseline gap-3">
          <h1 className="text-2xl font-bold tracking-tight">GitStream</h1>
          <p className="text-sm text-slate-500">
            GitHub organization health
          </p>
        </header>

        <StatusBar />

        <div className="mt-4 grid gap-4 lg:grid-cols-[340px_minmax(0,1fr)]">
          <div className="lg:sticky lg:top-4 lg:self-start">
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
    </DashboardProvider>
  );
}
