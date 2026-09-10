"use client";

import { DashboardProvider } from "./DashboardContext";
import { TopBar } from "./TopBar";
import { ScopeHint } from "./ScopeHint";
import { RepoSidebar } from "./RepoSidebar";
import { CommitActivityCard } from "./cards/CommitActivityCard";
import { PrHealthCard } from "./cards/PrHealthCard";
import { StaleBranchesCard } from "./cards/StaleBranchesCard";
import { ContributorActivityCard } from "./cards/ContributorActivityCard";
import { IssueVelocityCard } from "./cards/IssueVelocityCard";

/**
 * App-shell layout:
 *
 *   ┌──────────────┬───────────────────────────────────┐
 *   │  sidebar     │  top bar (identity · rate · token) │
 *   │  (logo +     ├───────────────────────────────────┤
 *   │   repo       │  scope hint (only if restricted)   │
 *   │   picker +   │                                    │
 *   │   repo list) │  metric card grid                  │
 *   └──────────────┴───────────────────────────────────┘
 *
 * The sidebar is the control surface — every card follows its selection.
 */
export function Dashboard({ defaultOrg }: { defaultOrg?: string }) {
  return (
    <DashboardProvider defaultOrg={defaultOrg}>
      <div className="flex min-h-screen flex-col lg:flex-row">
        <RepoSidebar />

        <main className="flex min-w-0 flex-1 flex-col">
          <TopBar />
          <div className="flex-1 px-4 py-5 sm:px-6">
            <ScopeHint />
            <div className="grid gap-4 xl:grid-cols-2">
              <CommitActivityCard />
              <PrHealthCard />
              <StaleBranchesCard />
              <ContributorActivityCard />
              <IssueVelocityCard />
            </div>
          </div>
        </main>
      </div>
    </DashboardProvider>
  );
}
