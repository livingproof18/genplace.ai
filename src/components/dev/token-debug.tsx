"use client";

import { useEffect, useState } from "react";
import { useTokens } from "@/hooks/use-tokens";

export function TokenDebugPanel() {
  const { tokens, loading, refreshTokens } = useTokens();
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const id = setInterval(() => refreshTokens(), 10_000);
    return () => clearInterval(id);
  }, [refreshTokens]);

  const cooldownSeconds = Math.max(
    0,
    Math.ceil(((tokens.cooldownUntil ?? 0) - now) / 1000)
  );

  return (
    <div className="fixed bottom-3 left-3 z-[2000] rounded-xl border border-black/20 bg-black/80 px-3 py-2 text-xs text-white shadow-lg">
      <div className="font-semibold">Dev Tokens</div>
      <div>Tokens: {loading ? "--" : tokens.current}</div>
      <div>Cooldown: {loading ? "--" : `${cooldownSeconds}s`}</div>
    </div>
  );
}
