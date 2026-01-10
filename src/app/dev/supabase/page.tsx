"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { createBrowserClient } from "@/lib/supabase/browser";

type StatusState = {
  label: string;
  detail?: string;
};

export default function SupabaseDevPage() {
  const supabase = React.useMemo(() => createBrowserClient(), []);
  const [status, setStatus] = React.useState<StatusState>({
    label: "Idle",
  });
  const [sessionJson, setSessionJson] = React.useState<string>(
    "No session loaded yet."
  );

  const setStatusFromError = (label: string, error?: Error | null) => {
    setStatus({
      label,
      detail: error?.message || undefined,
    });
  };

  const handleSignIn = async (provider: "google" | "discord") => {
    if (typeof window === "undefined") return;
    setStatus({ label: `Redirecting to ${provider}...` });
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    if (error) {
      console.error("OAuth sign-in error:", error);
      setStatusFromError("OAuth sign-in failed.", error);
    }
  };

  const handleSignOut = async () => {
    setStatus({ label: "Signing out..." });
    const { error } = await supabase.auth.signOut();
    if (error) {
      setStatusFromError("Sign out failed.", error);
      return;
    }
    setStatus({ label: "Signed out." });
    setSessionJson("No session loaded yet.");
  };

  const handleGetSession = async () => {
    setStatus({ label: "Fetching session..." });
    const { data, error } = await supabase.auth.getSession();
    if (error) {
      setStatusFromError("Get session failed.", error);
      return;
    }
    setStatus({ label: "Session fetched." });
    setSessionJson(JSON.stringify(data, null, 2));
  };

  const handlePing = async () => {
    setStatus({ label: "Pinging auth..." });
    const { data, error } = await supabase.auth.getUser();
    if (error) {
      setStatusFromError("Auth ping failed.", error);
      return;
    }
    setStatus({ label: "Auth ping ok." });
    setSessionJson(JSON.stringify(data, null, 2));
  };

  React.useEffect(() => {
    handleGetSession();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-6 py-10">
      <div>
        <h1 className="text-2xl font-semibold">Supabase Dev Test</h1>
        <p className="text-sm text-muted-foreground">
          Temporary page to validate OAuth, sessions, and basic connectivity.
        </p>
      </div>

      <div className="flex flex-wrap gap-3">
        <Button onClick={() => handleSignIn("google")}>
          Sign in with Google
        </Button>
        <Button onClick={() => handleSignIn("discord")}>
          Sign in with Discord
        </Button>
        <Button variant="secondary" onClick={handleSignOut}>
          Sign out
        </Button>
        <Button variant="outline" onClick={handleGetSession}>
          Get session
        </Button>
        <Button variant="outline" onClick={handlePing}>
          Test DB ping
        </Button>
      </div>

      <div className="rounded-lg border border-border/60 bg-muted/40 p-4">
        <div className="text-sm font-medium">Status</div>
        <div className="text-sm text-muted-foreground">{status.label}</div>
        {status.detail ? (
          <div className="text-sm text-red-600">{status.detail}</div>
        ) : null}
      </div>

      <div className="rounded-lg border border-border/60 bg-background p-4">
        <div className="text-sm font-medium">Session output</div>
        <pre className="mt-3 max-h-[360px] overflow-auto rounded-md bg-black/90 p-3 text-xs text-white">
          {sessionJson}
        </pre>
      </div>
    </div>
  );
}
