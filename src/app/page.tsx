import { Dashboard } from "@/components/dashboard/Dashboard";

/**
 * Server component — just reads the optional default-org env var and hands off
 * to the client dashboard shell.
 */
export default function HomePage() {
  return <Dashboard defaultOrg={process.env.NEXT_PUBLIC_DEFAULT_ORG || undefined} />;
}
