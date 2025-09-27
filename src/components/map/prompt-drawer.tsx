// src/components/map/prompt-drawer.tsx
"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { useEffect, useMemo, useRef, useState } from "react";
import { Wand2, X, Info, RotateCcw, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { mmss } from "@/lib/time";
import type { TokensState } from "@/hooks/use-tokens";
import type { PointPlacement } from "./types";

type Variant = { id: string; url: string };
type Size = 128 | 256 | 512;

type GenerateRequest = { prompt: string; size: Size };
type GenerateResponse = { requestId: string; variants: Variant[]; moderation?: { ok: boolean; reason?: string } };

type PlaceRequest = { variantId: string; size: Size; lat?: number; lng?: number };
type PlaceResponse = {
  placed: { x?: number; y?: number; url: string; z?: number; lat: number; lng: number };
  tokens: TokensState;
};
type BusyState = "idle" | "generating" | "placing";


export type PromptDrawerProps = {
  open: boolean;
  onOpenChange: (v: boolean) => void;

  // If provided, we’re in tile-first (point-first) flow
  presetPoint?: { lat: number; lng: number } | null;

  tokens: TokensState;
  onTokens: (t: TokensState) => void;

  // called after successful Place (to add to map)
  onPlaced: (p: PointPlacement) => void;

  // Optional: user not logged-in gate
  requireAuth?: boolean;
  onRequireAuth?: () => void;
};

const TIPS = [
  "A tiny dragon curled on a tea cup, cozy morning light",
  "Retro pixel art spaceship over neon city",
  "A fox wearing headphones in a rainy café",
  "Surreal floating islands at sunset",
  "Cute robot watering houseplants, isometric",
  "Ancient temple in a lush jungle, cinematic lighting",
];

const GEN_RATE_MS = 10_000; // 1 generate / 10s

export function PromptDrawer({
  open,
  onOpenChange,
  presetPoint,
  tokens,
  onTokens,
  onPlaced,
  requireAuth = false,
  onRequireAuth,
}: PromptDrawerProps) {
  // ---- ui state
  const [size, setSize] = useState<Size>(256);
  const [prompt, setPrompt] = useState("");
  const [busy, setBusy] = useState<BusyState>("idle");
  const [variants, setVariants] = useState<Variant[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [waitingPoint, setWaitingPoint] = useState<boolean>(!presetPoint);

  // live point for idea-first flow (updated when user clicks map)
  const [point, setPoint] = useState<{ lat: number; lng: number } | null>(presetPoint ?? null);

  // enforce rate-limit on generate
  const lastGenAtRef = useRef<number>(0);

  useEffect(() => {
    // keep preset in sync when the drawer opens tile-first
    if (open) {
      setPoint(presetPoint ?? null);
      setWaitingPoint(!presetPoint);
    }
  }, [open, presetPoint]);

  // listen for your existing custom event fired by MapLibreWorld on click
  useEffect(() => {
    if (!open) return;
    const onPick = (e: any) => {
      const d = e?.detail;
      if (!d) return;
      setPoint({ lat: d.lat, lng: d.lng });
      setWaitingPoint(false);
    };
    window.addEventListener("genplace:create:point", onPick as any);
    return () => window.removeEventListener("genplace:create:point", onPick as any);
  }, [open]);

  // ---- helpers (mock services)

  // cheap image mock: two seeded picsum images by prompt hash
  function fakeImagesFor(prompt: string): Variant[] {
    const seed = Math.abs(hash(prompt));
    return [
      { id: `A_${seed}`, url: `https://picsum.photos/seed/${seed}/512/512` },
      { id: `B_${seed + 1}`, url: `https://picsum.photos/seed/${seed + 1}/512/512` },
    ];
  }

  function hash(s: string) {
    let h = 0;
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
    return h;
  }

  async function generate(req: GenerateRequest): Promise<GenerateResponse> {
    // moderation stub
    if (/[^\w\s].*nsfw|gore|kill|nazi/i.test(req.prompt)) {
      return {
        requestId: crypto.randomUUID(),
        variants: [],
        moderation: { ok: false, reason: "unsafe" },
      };
    }
    // simulate latency
    await wait(900 + Math.random() * 900);
    return {
      requestId: crypto.randomUUID(),
      variants: fakeImagesFor(req.prompt.trim() || "default"),
    };
  }

  async function regenerateOne(slot: 0 | 1) {
    if (busy !== "idle") return;
    setBusy("generating");
    setError(null);
    try {
      await wait(700 + Math.random() * 600);
      const alt = `https://picsum.photos/seed/${Math.floor(Math.random() * 10_000)}/512/512`;
      setVariants((v) => {
        const next = [...v];
        if (next[slot]) next[slot] = { ...next[slot], id: crypto.randomUUID(), url: alt };
        return next;
      });
    } finally {
      setBusy("idle");
    }
  }

  // Place: consume token here (MVP rule)
  async function place(req: PlaceRequest): Promise<PlaceResponse> {
    await wait(600 + Math.random() * 600);
    if (!point) throw new Error("No placement point");
    const picked = variants.find((v) => v.id === req.variantId)!;

    const next: TokensState =
      tokens.current > 0
        ? {
          current: tokens.current - 1,
          max: tokens.max,
          nextRegenAt:
            tokens.current - 1 < tokens.max ? Date.now() + 2 * 60 * 1000 : tokens.nextRegenAt,
        }
        : tokens;

    return {
      placed: { url: picked.url, lat: point.lat, lng: point.lng },
      tokens: next,
    };
  }

  function wait(ms: number) {
    return new Promise((r) => setTimeout(r, ms));
  }

  // ---- actions

  const canGenerate = busy === "idle";
  const canPlace =
    !!selectedId &&
    !!point &&
    tokens.current > 0;


  async function onGenerate() {
    if (requireAuth) {
      onRequireAuth?.();
      return;
    }
    if (!canGenerate) return;

    // rate limit
    const now = Date.now();
    const since = now - lastGenAtRef.current;
    if (since < GEN_RATE_MS) {
      setError(`Please wait ${mmss(GEN_RATE_MS - since)} before generating again.`);
      return;
    }

    if (!prompt.trim()) {
      setError("Add a prompt or pick one from Tips.");
      return;
    }
    setError(null);
    setBusy("generating");
    setSelectedId(null);
    try {
      const res = await generate({ prompt, size });
      lastGenAtRef.current = Date.now();
      if (res.moderation && !res.moderation.ok) {
        setVariants([]);
        setError(
          "That prompt might be unsafe. Try rephrasing or pick one from Tips."
        );
        return;
      }
      setVariants(res.variants.slice(0, 2));
    } catch {
      setError("Something went wrong. Try again.");
    } finally {
      setBusy("idle");
    }
  }

  async function onPlace() {
    if (!canPlace || !selectedId) return;
    setBusy("placing");
    setError(null);
    try {
      const res = await place({ variantId: selectedId, size, lat: point!.lat, lng: point!.lng });
      onTokens(res.tokens);
      // bubble to map
      onPlaced({
        id: crypto.randomUUID(),
        url: res.placed.url,
        lat: point!.lat,
        lng: point!.lng,
        pixelSize: size,
        anchor: "bottom",
      });
      onOpenChange(false);
    } catch {
      setError("Couldn’t place right now. Try again.");
    } finally {
      setBusy("idle");
    }
  }

  const cooldownMs = Math.max(0, tokens.nextRegenAt - Date.now());

  // ---- UI

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/40 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out" />
        <Dialog.Content
          className={cn(
            "fixed right-0 top-0 h-dvh w-full max-w-[480px] bg-background border-l",
            "shadow-2xl focus:outline-none data-[state=open]:animate-in data-[state=closed]:animate-out",
            "p-4 sm:p-5"
          )}
          role="dialog"
          aria-describedby={undefined}
        >
          <div className="flex items-center justify-between">
            <Dialog.Title className="text-lg font-semibold">Create</Dialog.Title>
            <div className="text-xs font-mono text-muted-foreground">
              Tokens {tokens.current}/{tokens.max}
              {tokens.current < tokens.max && ` • Next +1 in ${mmss(cooldownMs)}`}
            </div>
            <Dialog.Close asChild>
              <button className="ml-3 inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-muted">
                <X className="h-4 w-4" />
              </button>
            </Dialog.Close>
          </div>

          {/* Size chips */}
          <div className="mt-4 flex gap-2">
            {[128, 256, 512].map((s) => (
              <button
                key={s}
                onClick={() => setSize(s as Size)}
                className={cn(
                  "px-3 py-1.5 rounded-full text-sm border",
                  size === s ? "bg-primary text-primary-foreground border-primary" : "hover:bg-muted"
                )}
              >
                {s}
                <span className="ml-2 text-[10px] opacity-70 align-middle">(1 token)</span>
              </button>
            ))}
          </div>

          {/* Prompt */}
          <label className="mt-4 block text-sm font-medium">Prompt</label>
          <textarea
            autoFocus
            rows={4}
            placeholder="A tiny dragon curled on a tea cup, cozy morning light"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === "Enter") onGenerate();
            }}
            className="mt-2 w-full resize-none rounded-lg border bg-background p-3 outline-none focus:ring-2 ring-primary"
            disabled={busy !== "idle"}
          />

          {/* Tips */}
          <div className="mt-2 text-xs">
            <span className="text-muted-foreground mr-2">Need inspiration?</span>
            {TIPS.map((t, i) => (
              <button
                key={i}
                className="mr-1 mb-1 rounded-full border px-2 py-1 hover:bg-muted"
                onClick={() => setPrompt(t)}
                disabled={busy !== "idle"}
              >
                {t}
              </button>
            ))}
          </div>

          {/* Actions */}
          <div className="mt-4 flex gap-2">
            <button
              onClick={onGenerate}
              disabled={!canGenerate}
              className={cn(
                "inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-primary-foreground",
                "disabled:opacity-60"
              )}
            >
              <Wand2 className="h-4 w-4" />
              Generate
            </button>
            <Dialog.Close asChild>
              <button className="rounded-md border px-4 py-2 hover:bg-muted">Cancel</button>
            </Dialog.Close>
          </div>

          {/* Generating state */}
          {busy === "generating" && (
            <div className="mt-5">
              <div className="mb-2 h-2 w-full overflow-hidden rounded bg-muted">
                <div className="h-full w-1/3 animate-[progress_1.2s_linear_infinite] bg-primary" />
              </div>
              <p className="text-sm text-muted-foreground">Dreaming up your dragon…</p>
              <style jsx>{`
                @keyframes progress {
                  from { transform: translateX(-100%); }
                  to { transform: translateX(300%); }
                }
              `}</style>
              {/* skeletons */}
              <div className="mt-4 grid grid-cols-2 gap-3">
                {[0, 1].map((i) => (
                  <div key={i} className="aspect-square rounded-xl bg-muted animate-pulse" />
                ))}
              </div>
            </div>
          )}

          {/* Preview */}
          {variants.length > 0 && busy !== "generating" && (
            <div className="mt-5 grid grid-cols-2 gap-3">
              {variants.map((v, i) => {
                const selected = selectedId === v.id;
                return (
                  <div key={v.id} className="relative">
                    <button
                      onClick={() => setSelectedId(v.id)}
                      className={cn(
                        "block aspect-square w-full overflow-hidden rounded-xl border",
                        "hover:brightness-105",
                        selected && "ring-2 ring-primary ring-offset-2"
                      )}
                    >
                      <img
                        src={v.url}
                        alt="Variant"
                        className="h-full w-full object-cover"
                        draggable={false}
                      />
                    </button>
                    <button
                      onClick={() => regenerateOne(i as 0 | 1)}
                      className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-md bg-white/90 px-2 py-1 text-xs shadow hover:bg-white"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      Regenerate
                    </button>
                    {selected && (
                      <div className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-md bg-primary px-2 py-1 text-xs text-primary-foreground shadow">
                        <Check className="h-3.5 w-3.5" />
                        Selected
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Placement banner (idea-first) */}
          {variants.length > 0 && !presetPoint && (
            <div className={cn("mt-4 rounded-lg border p-3", waitingPoint ? "bg-amber-50" : "bg-emerald-50")}>
              <div className="flex items-center gap-2 text-sm">
                <Info className="h-4 w-4" />
                {waitingPoint ? "Pick a tile on the map to place this image." : "Tile selected. Ready to place."}
              </div>
            </div>
          )}

          {/* Error */}
          {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

          {/* Sticky Place button */}
          <div className="pointer-events-none fixed bottom-0 right-0 w-full max-w-[480px] p-4 sm:p-5">
            <div className="pointer-events-auto rounded-xl border bg-background/95 p-3 shadow-xl backdrop-blur supports-[backdrop-filter]:bg-background/70">
              <div className="flex items-center justify-between gap-3">
                <button
                  onClick={onPlace}
                  disabled={!canPlace || busy === "placing"}
                  className={cn(
                    "inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-primary-foreground",
                    "disabled:opacity-60"
                  )}
                >
                  {busy === "placing" ? "Placing…" : `Place (1 token)`}
                </button>
                <div className="text-xs font-mono text-muted-foreground">
                  {tokens.current > 0
                    ? "Tokens available"
                    : `Out of tokens — regenerates in ${mmss(cooldownMs)}`}
                </div>
              </div>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
