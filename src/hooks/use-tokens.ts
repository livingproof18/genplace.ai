// src/hooks/use-tokens.ts
"use client";

import { useCallback, useEffect, useState } from "react";

export type TokensState = {
  current: number;
  max: number;
  cooldownUntil: number | null; // epoch ms
  totalGenerations: number;
};

type TokenRow = {
  tokens_current: number;
  tokens_max: number;
  cooldown_until: string | null;
  total_generations: number | null;
};

const EMPTY: TokensState = {
  current: 0,
  max: 0,
  cooldownUntil: null,
  totalGenerations: 0,
};

function toTokenState(row: TokenRow): TokensState {
  const cooldownMs = row.cooldown_until
    ? Date.parse(row.cooldown_until)
    : Number.NaN;

  return {
    current: row.tokens_current ?? 0,
    max: row.tokens_max ?? 0,
    cooldownUntil: Number.isFinite(cooldownMs) ? cooldownMs : null,
    totalGenerations: row.total_generations ?? 0,
  };
}

export function useTokens() {
  const [tokens, setTokens] = useState<TokensState>(EMPTY);
  const [loading, setLoading] = useState(true);

  const applyTokenState = useCallback((row: TokenRow | null | undefined) => {
    if (!row) return;
    setTokens(toTokenState(row));
  }, []);

  const refreshTokens = useCallback(async () => {
    try {
      const res = await fetch("/api/tokens", { method: "GET" });
      if (!res.ok) {
        setTokens(EMPTY);
        return;
      }
      const data = (await res.json().catch(() => ({}))) as {
        tokens?: TokenRow;
      };
      applyTokenState(data.tokens);
    } finally {
      setLoading(false);
    }
  }, [applyTokenState]);

  useEffect(() => {
    refreshTokens();
  }, [refreshTokens]);

  return { tokens, loading, refreshTokens, applyTokenState };
}
