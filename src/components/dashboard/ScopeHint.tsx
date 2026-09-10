"use client";

import { useVerify } from "./useVerify";

/**
 * Explains why private repos / org repos might be missing. GitStream never
 * filters by visibility — it's always a token-permission issue — so this banner
 * is the honest answer to "where are my repos?". Only renders when something is
 * actually restricted (or the token is outright broken).
 */
export function ScopeHint() {
  const info = useVerify();

  if (info.state === "error") {
    const auth =
      info.kind === "MISSING_TOKEN" || info.kind === "BAD_CREDENTIALS";
    if (!auth) return null;
    return (
      <Banner tone="danger" title="GitHub token not working">
        {info.message} — set <Code>GITHUB_TOKEN</Code> in{" "}
        <Code>.env.local</Code> to a PAT with <Code>repo</Code> +{" "}
        <Code>read:org</Code>, then restart. See the README.
      </Banner>
    );
  }

  if (info.state !== "ok") return null;
  const data = info.data;
  const fineGrained = data.tokenScopes == null;

  if (fineGrained) {
    if (data.organizations.length > 0) return null;
    return (
      <Banner tone="warn" title="Fine-grained token — limited view">
        It only sees the one account it was created for, and only repos you
        granted it (<Code>Metadata</Code> + <Code>Contents: Read</Code>). To
        cover an organization, create the token under that org — or use a{" "}
        <strong>classic</strong> PAT with <Code>repo</Code> + <Code>read:org</Code>,
        which spans everything you can access. Nothing is filtered here; private
        repos show when the token can read them.
      </Banner>
    );
  }

  const missing: Array<[string, string]> = [];
  if (data.canReadPrivate === false)
    missing.push(["repo", "private repositories"]);
  if (data.canReadOrgs === false)
    missing.push(["read:org", "organization repositories"]);
  if (missing.length === 0) return null;

  return (
    <Banner tone="warn" title="Token is missing scopes">
      {missing.map(([scope, what], i) => (
        <span key={scope}>
          {i > 0 && ", "}
          <Code>{scope}</Code> ({what})
        </span>
      ))}
      . Regenerate the classic PAT with those scopes, update{" "}
      <Code>.env.local</Code>, restart. Private repos aren&apos;t filtered — they
      show when the token can read them.
    </Banner>
  );
}

function Banner({
  tone,
  title,
  children,
}: {
  tone: "warn" | "danger";
  title: string;
  children: React.ReactNode;
}) {
  const c =
    tone === "danger"
      ? "border-danger/40 bg-danger/5 text-danger"
      : "border-warn/30 bg-warn/5 text-warn";
  return (
    <div className={`mb-4 rounded-lg border px-4 py-2.5 text-xs ${c}`}>
      <span className="font-semibold">{title}.</span> {children}
    </div>
  );
}

function Code({ children }: { children: React.ReactNode }) {
  return <code className="font-mono">{children}</code>;
}
