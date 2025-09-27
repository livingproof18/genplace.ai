// src/hooks/use-tokens.ts
"use client";

import { useEffect, useRef, useState } from "react";

export type TokensState = {
  current: number;
  max: number;
  nextRegenAt: number; // epoch ms
};

const STORAGE_KEY = "genplace:tokens:v1";

const DEFAULT: TokensState = {
  current: 5,
  max: 5,
  nextRegenAt: Date.now(), // regenerate only when < max
};

// MVP: +1 token every 2 minutes (tweak freely)
const REGEN_MS = 2 * 60 * 1000;

export function useTokens() {
  const [tokens, setTokens] = useState<TokensState>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : DEFAULT;
    } catch {
      return DEFAULT;
    }
  });

  // persist
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(tokens));
    } catch {}
  }, [tokens]);

  // regen loop
  const raf = useRef<number | null>(null);
  useEffect(() => {
    const tick = () => {
      const now = Date.now();
      setTokens((t) => {
        if (t.current >= t.max) return t;
        if (now >= t.nextRegenAt) {
          const next = Math.min(t.max, t.current + 1);
          return {
            current: next,
            max: t.max,
            nextRegenAt: next >= t.max ? now : now + REGEN_MS,
          };
        }
        return t;
      });
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current);
    };
  }, []);

  const consume = (n = 1) =>
    setTokens((t) => {
      if (t.current < n) return t;
      const left = t.current - n;
      return {
        current: left,
        max: t.max,
        nextRegenAt: left < t.max ? Date.now() + REGEN_MS : t.nextRegenAt,
      };
    });

  const setMax = (max: number) =>
    setTokens((t) => ({
      current: Math.min(t.current, max),
      max,
      nextRegenAt: t.current < max ? Date.now() + REGEN_MS : t.nextRegenAt,
    }));

  return { tokens, consume, setTokens, setMax };
}
