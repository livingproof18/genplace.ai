// src/components/mosaic-preview.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";

// Swap these with curated thumbnails from /public/samples/*
const sampleImages = [
    "/samples/dragon-1.jpg",
    "/samples/city-1.jpg",
    "/samples/forest-1.jpg",
    "/samples/neon-1.jpg",
    "/samples/lofi-1.jpg",
    "/samples/mech-1.jpg",
    "/samples/nebula-1.jpg",
    "/samples/retro-1.jpg",
    "/samples/pixel-1.jpg",
    "/samples/watercolor-1.jpg",
];

type Tile = { id: string; src: string; label: string; ver: number };

const LABELS = [
    "koi", "mech", "nebula", "city", "forest", "dragon",
    "lofi", "retro", "vapor", "tiles", "pixel", "synth",
];

function usePrefersReducedMotion() {
    const [prefers, setPrefers] = useState(false);
    useEffect(() => {
        const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
        setPrefers(mq.matches);
        const onChange = (e: MediaQueryListEvent) => setPrefers(e.matches);
        mq.addEventListener?.("change", onChange);
        return () => mq.removeEventListener?.("change", onChange);
    }, []);
    return prefers;
}

export function MosaicPreview({
    cols = 6,
    rows = 6,
    size = 88,
    showCaption = true,
}: {
    cols?: number;
    rows?: number;
    size?: number;
    showCaption?: boolean;
}) {
    const prefersReducedMotion = usePrefersReducedMotion();
    const containerRef = useRef<HTMLDivElement | null>(null);
    const [visible, setVisible] = useState(true);
    const [tiles, setTiles] = useState<Tile[]>([]);

    // Initial grid: random images/labels
    const initial = useMemo<Tile[]>(
        () =>
            Array.from({ length: cols * rows }, (_, i) => ({
                id: String(i),
                src: sampleImages[Math.floor(Math.random() * sampleImages.length)],
                label: LABELS[Math.floor(Math.random() * LABELS.length)],
                ver: 0, // bump to trigger animation
            })),
        [cols, rows]
    );

    // Set up tiles once
    useEffect(() => setTiles(initial), [initial]);

    // Pause when offscreen
    useEffect(() => {
        if (!containerRef.current) return;
        const el = containerRef.current;
        const io = new IntersectionObserver(
            (entries) => setVisible(entries[0]?.isIntersecting ?? true),
            { rootMargin: "0px", threshold: 0.1 }
        );
        io.observe(el);
        return () => io.disconnect();
    }, []);

    // Pause when tab hidden
    const [pageVisible, setPageVisible] = useState(true);
    useEffect(() => {
        const onVis = () => setPageVisible(document.visibilityState === "visible");
        document.addEventListener("visibilitychange", onVis);
        return () => document.removeEventListener("visibilitychange", onVis);
    }, []);

    // Soft cadence swaps (1–2 tiles/sec), no work if reduced motion or hidden
    useEffect(() => {
        if (prefersReducedMotion) return; // static grid
        if (!visible || !pageVisible) return;

        let cancelled = false;

        const tick = () => {
            if (cancelled) return;

            setTiles((prev) => {
                // Replace 1 tile per tick (sometimes 2) for gentle motion
                const swaps = Math.random() < 0.25 ? 2 : 1;
                const next = [...prev];
                for (let s = 0; s < swaps; s++) {
                    const idx = Math.floor(Math.random() * next.length);
                    next[idx] = {
                        ...next[idx],
                        src: sampleImages[Math.floor(Math.random() * sampleImages.length)],
                        label: LABELS[Math.floor(Math.random() * LABELS.length)],
                        ver: next[idx].ver + 1, // bump to re-animate
                    };
                }
                return next;
            });

            // Jitter interval between 600–1200ms
            const delay = 600 + Math.random() * 600;
            timeout = window.setTimeout(tick, delay);
        };

        let timeout = window.setTimeout(tick, 700);
        return () => {
            cancelled = true;
            window.clearTimeout(timeout);
        };
    }, [visible, pageVisible, prefersReducedMotion]);

    return (
        <div className="inline-block" ref={containerRef} aria-label="Mosaic preview">
            <div
                className="rounded-2xl border p-3 bg-card/60 backdrop-blur"
                style={{ width: cols * (size + 6), maxWidth: "100%" }}
            >
                <div
                    className="grid gap-1"
                    style={{ gridTemplateColumns: `repeat(${cols}, ${size}px)` }}
                >
                    {tiles.map((t) => (
                        <TileCell key={t.id} t={t} size={size} />
                    ))}
                </div>
            </div>

            {showCaption && (
                <p className="mt-3 text-xs text-muted-foreground flex items-center gap-2">
                    <span className="inline-block h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
                    This is how the canvas evolves →
                </p>
            )}
        </div>
    );
}

function TileCell({ t, size }: { t: Tile; size: number }) {
    // We animate when `ver` changes by giving the image a key and a small scale/opacity intro.
    return (
        <div
            className="relative rounded-md overflow-hidden border bg-muted/40"
            style={{ width: size, height: size }}
        >
            {/* image */}
            <img
                key={t.ver}
                src={t.src}
                alt={t.label}
                className="absolute inset-0 h-full w-full object-cover
                   opacity-0 scale-95 will-change-transform will-change-opacity
                   [transition:opacity_180ms_ease,transform_220ms_cubic-bezier(0.2,0.8,0.2,1)]"
                onLoad={(e) => {
                    // trigger fade/scale in after load to avoid flash
                    const el = e.currentTarget;
                    requestAnimationFrame(() => {
                        el.style.opacity = "1";
                        el.style.transform = "scale(1)";
                    });
                }}
                draggable={false}
            />
            {/* soft overlay */}
            <div className="absolute inset-0 bg-black/10" />
            {/* label chip */}
            <span className="absolute bottom-1 left-1 text-[10px] px-1.5 py-0.5 rounded-full bg-background/70 border text-foreground/80">
                {t.label}
            </span>
        </div>
    );
}
