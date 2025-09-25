// src/components/map/maplibre-world.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { GridPlacement } from "./types";
import { TopLeftControls } from "./top-left-controls";
import { TopRightControls } from "./top-right-controls"; // ⬅️ add this import
import { BottomCenterAction } from "./bottom-center-action";
import { toast } from "sonner";
import { SelectionModal, type TileMeta } from "./selection-modal";
import { Info } from "lucide-react";

// ---- CONFIG ----
const TILE_ZOOM = 5;
const STYLE_URL = "https://tiles.openfreemap.org/styles/liberty";
// ----------------
// === Checkpoint spec constants (MapLibre/GL) ===
const TILE_SIZE = 256;                 // your canvas/generation tile size
const MIN_INTERACT_ZOOM = 17.0;        // block tagging below this
const TILES_VISIBLE_ZOOM = 16.5;       // hide gp_* overlays below this
const CLICK_DEBOUNCE_MS = 250;
const MOVE_TOL_PX = 5;                 // dragging vs click

// A placement anchored at an exact lat/lng (no grid)
type PointPlacement = {
    id: string;          // stable ID for this artwork (e.g., server id or hash)
    url: string;         // image URL
    lat: number;
    lng: number;
    pixelSize?: number;  // optional: desired pixel size for the icon (default 256)
    anchor?: "center" | "bottom" | "top" | "left" | "right" | "bottom-left" | "bottom-right" | "top-left" | "top-right";
};


// ---------------- Slippy helpers ----------------
function lon2tile(lon: number, z: number) {
    return Math.floor(((lon + 180) / 360) * Math.pow(2, z));
}
function lat2tile(lat: number, z: number) {
    const rad = (lat * Math.PI) / 180;
    return Math.floor(((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * Math.pow(2, z));
}
function tile2lon(x: number, z: number) { return (x / Math.pow(2, z)) * 360 - 180; }
function tile2lat(y: number, z: number) {
    const n = Math.PI - (2 * Math.PI * y) / Math.pow(2, z);
    return (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
}
function tileBounds(x: number, y: number, z: number) {
    const west = tile2lon(x, z);
    const east = tile2lon(x + 1, z);
    const north = tile2lat(y, z);
    const south = tile2lat(y + 1, z);
    return [
        [west, north], [east, north], [east, south], [west, south],
    ] as [[number, number], [number, number], [number, number], [number, number]];
}

// Unique id for our art tile
const artId = (x: number, y: number, z: number) => `gp_${x}_${y}_${z}`;

// Fingerprint a placement so we know if the image/coords actually changed
const fpPlacement = (p: GridPlacement) =>
    `${p.url}|${p.x}|${p.y}|${p.z}`;

// Build a simple signature for placements we actually render
const placementsSig = (list: GridPlacement[]) =>
    list
        .filter(p => p.z === TILE_ZOOM)
        .map(p => `${p.x},${p.y},${p.z}:${p.url}`)
        .sort()
        .join(";");

// ------
// ---- camera animation helpers ----
// -------- Smooth flight helper (wplace-style) --------
function easeInOutCubic(t: number) {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

/**
 * flySmooth:
 * Uses map.flyTo (zoom + pan together) with tuned params to emulate:
 *   - gentle zoom-out while starting to pan
 *   - steady travel
 *   - smooth decelerating zoom-in at destination
 *
 * center: [lng, lat]
 * finalZoom: number (e.g., 11 for locate, ~4.5 for explore)
 * options (optional):
 *   - speed: lower = slower (default 0.6)
 *   - curve: flight curvature (default 1.35)
 *   - maxDuration: cap long flights (ms) — optional
 *   - For very long jumps (e.g., London → Sydney), consider setting maxDuration ~2500–3200ms so it doesn’t take too long.
 */
function flySmooth(
    map: any,
    center: [number, number],
    finalZoom: number,
    options?: { speed?: number; curve?: number; maxDuration?: number }
) {
    if (!map) return;

    const { speed = 0.7, curve = 1.35, maxDuration } = options || {};

    if (typeof map.flyTo === "function") {
        map.flyTo({
            center,
            zoom: finalZoom,
            speed,         // default ~1.2; lower => slower, smoother
            curve,         // default ~1.42; tweak shape of zoom path
            easing: easeInOutCubic,
            bearing: 0,
            pitch: 0,
            // By default duration is computed from distance & speed/curve.
            // You can cap it for very long hops:
            ...(maxDuration ? { maxDuration } : {}),
            // essential: true  // (optional) mark as essential for prefers-reduced-motion
        });
        return;
    }

    // Fallback (older builds): two-step ease
    const currentZoom = map.getZoom?.() ?? 3;
    const midZoom = Math.max(2.2, Math.min(currentZoom, finalZoom) - 2.8);

    // Step A: soften by easing out to a mid zoom
    map.easeTo({
        zoom: midZoom,
        duration: 450,
        easing: easeInOutCubic,
        bearing: 0,
        pitch: 0,
    });

    // Step B: slide + ease in to target
    map.once("moveend", () => {
        map.easeTo({
            center,
            zoom: finalZoom,
            duration: 900,
            easing: easeInOutCubic,
            bearing: 0,
            pitch: 0,
        });
    });
}
// -----------------------------------------------------




// === Declutter helpers (style-aware & gentle) ===
function applyDeclutter(map: any) {
    const style = map.getStyle?.();
    if (!style || !style.layers) return;

    const layers: any[] = style.layers;
    const isOurOverlay = (l: any) => typeof l?.id === "string" && l.id.startsWith("gp_");
    const hideIf = (pred: (l: any) => boolean) => {
        layers.forEach(l => {
            if (isOurOverlay(l)) return;
            if (pred(l) && map.getLayer(l.id)) {
                try { map.setLayoutProperty(l.id, "visibility", "none"); } catch { }
            }
        });
    };

    hideIf(l =>
        l["source-layer"] === "building" ||
        /building|building_outline|building-?number|housenumber/i.test(l.id) ||
        l.type === "fill-extrusion"
    );
    hideIf(l =>
        /(^|_)poi(_|$)|amenity|mbxpoi|place_of_worship/i.test(l.id) &&
        !/place-label|place_label|transport|airport_label/i.test(l.id)
    );
    hideIf(l => /aeroway|runway|taxiway/i.test(l.id) && !/airport_label/i.test(l.id));
    hideIf(l =>
        /tree|wood_symbol/i.test(l.id) &&
        !/landuse|landcover|park|forest|wood|grass|meadow/i.test(l.id)
    );
}
function installDeclutterHooks(map: any) {
    try { map.setTerrain(null as any); } catch { }
    map.dragRotate.disable();
    map.touchZoomRotate.disableRotation();
    map.keyboard?.disableRotation?.();

    let raf: number | null = null;
    let lastRunSignature = "";
    const runOnceSettled = () => {
        if (raf !== null) cancelAnimationFrame(raf);
        raf = requestAnimationFrame(() => {
            if (!map.isStyleLoaded?.()) return;
            const layers = map.getStyle?.().layers || [];
            const sig = layers.length + ":" + layers.map((l: any) => l.id).join("|");
            if (sig !== lastRunSignature) {
                applyDeclutter(map);
                lastRunSignature = sig;
            }
        });
    };
    runOnceSettled();
    map.on("styledata", runOnceSettled);
    map.on("error", (e: any) => {
        const err = e?.error;
        if (err?.name === "AbortError") return;
        console.error("[MapLibre error]", err || e);
    });
    map.once("remove", () => { if (raf !== null) cancelAnimationFrame(raf); });
}
// -------------- Checkpoint helpers --------------
type Checkpoint = { x: number; y: number; lat: number; lng: number; zoom: number; placedAt: number };
const MUTE_KEY = "genplace:map:mute";


// --- one-time CSS for a tiny pulse animation (injected once) ---
let __pinCssInjected = false;
function ensurePinCss() {
    if (__pinCssInjected) return;
    __pinCssInjected = true;
    const css = `
  @keyframes gp-pulse {
    0%   { transform: scale(1);   opacity: .35; }
    70%  { transform: scale(1.35); opacity: 0;  }
    100% { transform: scale(1.35); opacity: 0;  }
  }
  .gp-pin-wrap { position: relative; width: 27px; height: 41px; }
  .gp-pin-svg  { display:block; filter: drop-shadow(0 8px 18px rgba(59,130,246,.28)); }
  .gp-pin-dot  { position: absolute; left: 50%; bottom: 3px; width: 8px; height: 8px;
                 transform: translateX(-50%); border-radius: 9999px; background: rgb(59,130,246);
                 box-shadow: 0 6px 12px rgba(59,130,246,.35); }
  .gp-pin-pulse{ position: absolute; left: 50%; bottom: 3px; width: 8px; height: 8px;
                 transform: translateX(-50%); border-radius: 9999px; background: rgb(59,130,246);
                 opacity: .35; }
  @media (prefers-reduced-motion: no-preference) {
    .gp-pin-pulse { animation: gp-pulse 1200ms ease-out infinite; }
  }`;
    const el = document.createElement("style");
    el.textContent = css;
    document.head.appendChild(el);
}

/**
 * makeMarkerElPin:
 * A crisp “map pin” like wplace — blue fill, inner white dot, soft shadow, pulse halo.
 * You can pass a custom brand color if you want (defaults to Tailwind blue-500).
 */
function makeMarkerElPin(color = "#3B82F6") {
    ensurePinCss();

    // Root handed to MapLibre. Keep transform-neutral on this element.
    const root = document.createElement("div");
    root.setAttribute("role", "img");
    root.setAttribute("aria-label", "Checkpoint");

    // Container we animate (scale/opacity), anchored bottom-center via Marker options.
    const wrap = document.createElement("div");
    wrap.className = "gp-pin-wrap gp-pin-anim";
    wrap.style.transformOrigin = "50% 100%";
    wrap.style.opacity = "0";
    wrap.style.transform = "scale(0.92)";

    // SVG pin (27x41) — fill color = brand blue, subtle outer rim via opacity
    wrap.innerHTML = `
    <svg class="gp-pin-svg" width="27" height="41" viewBox="0 0 27 41" aria-hidden="true">
      <g fill-rule="nonzero">
        <!-- pin body -->
        <g fill="${color}">
          <path d="M27,13.5 C27,19.074644 20.250001,27.000002 14.75,34.500002 C14.016665,35.500004 12.983335,35.500004 12.25,34.500002 C6.7499993,27.000002 0,19.222562 0,13.5 C0,6.0441559 6.0441559,0 13.5,0 C20.955844,0 27,6.0441559 27,13.5 Z"></path>
        </g>
        <!-- outer rim -->
        <g opacity="0.22" fill="#000000">
          <path d="M13.5,0 C6.0441559,0 0,6.0441559 0,13.5 C0,19.222562 6.7499993,27 12.25,34.5 C13,35.522727 14.016664,35.500004 14.75,34.5 C20.250001,27 27,19.074644 27,13.5 C27,6.0441559 20.955844,0 13.5,0 Z M13.5,1 C20.415404,1 26,6.584596 26,13.5 C26,15.898657 24.495584,19.181431 22.220703,22.738281 C19.945823,26.295132 16.705119,30.142167 13.943359,33.908203 C13.743445,34.180814 13.612715,34.322738 13.5,34.441406 C13.387285,34.322738 13.256555,34.180814 13.056641,33.908203 C10.284481,30.127985 7.4148684,26.314159 5.015625,22.773438 C2.6163816,19.232715 1,15.953538 1,13.5 C1,6.584596 6.584596,1 13.5,1 Z"></path>
        </g>
        <!-- inner white dot -->
        <g transform="translate(8,8)">
          <circle fill="#000000" opacity="0.2" cx="5.5" cy="5.5" r="5.5"></circle>
          <circle fill="#FFFFFF" cx="5.5" cy="5.5" r="5.5"></circle>
        </g>
      </g>
    </svg>
  `;

    // Small dot that touches the ground + a gentle pulse
    const dot = document.createElement("div");
    dot.className = "gp-pin-dot";
    const pulse = document.createElement("div");
    pulse.className = "gp-pin-pulse";

    wrap.appendChild(dot);
    wrap.appendChild(pulse);
    root.appendChild(wrap);

    // Pop-in (respect reduced motion)
    const prefersReduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    requestAnimationFrame(() => {
        wrap.style.transition = "transform 180ms ease, opacity 140ms ease";
        wrap.style.opacity = "1";
        wrap.style.transform = prefersReduced ? "none" : "scale(1)";
    });

    // Stash a reference for re-pop on move
    (root as any).__inner = wrap;
    return root as HTMLDivElement;
}

function makeClickDotEl() {
    const el = document.createElement("div");
    el.style.width = "10px";
    el.style.height = "10px";
    el.style.borderRadius = "9999px";
    el.style.background = "white";
    el.style.boxShadow = "0 0 0 2px rgba(59,130,246,.9), 0 6px 16px rgba(0,0,0,.28)";
    el.style.transform = "translate(-50%, -50%)";
    el.style.opacity = "1";
    el.style.transition = "transform 300ms ease, opacity 300ms ease";
    requestAnimationFrame(() => {
        el.style.transform = "translate(-50%, -50%) scale(1.35)";
        el.style.opacity = "0";
    });
    return el;
}

const CLICK_TILE_SRC = "gp__click_tile_src";
const CLICK_TILE_LAYER = "gp__click_tile_layer";

function geojsonForTile(x: number, y: number, zInt: number) {
    const b = tileBounds(x, y, zInt); // you already have tileBounds()
    return {
        type: "FeatureCollection",
        features: [
            {
                type: "Feature",
                geometry: {
                    type: "Polygon", coordinates: [[
                        [b[0][0], b[0][1]],
                        [b[1][0], b[1][1]],
                        [b[2][0], b[2][1]],
                        [b[3][0], b[3][1]],
                        [b[0][0], b[0][1]],
                    ]]
                },
                properties: {},
            },
        ],
    } as any;
}

function flashTileOutline(map: any, x: number, y: number, zInt: number) {
    const data = geojsonForTile(x, y, zInt);
    if (!map.getSource(CLICK_TILE_SRC)) {
        map.addSource(CLICK_TILE_SRC, { type: "geojson", data });
        map.addLayer({
            id: CLICK_TILE_LAYER,
            type: "line",
            source: CLICK_TILE_SRC,
            paint: { "line-color": "#3B82F6", "line-width": 2, "line-opacity": 0.9 },
        });
    } else {
        (map.getSource(CLICK_TILE_SRC) as any).setData(data);
        map.setPaintProperty(CLICK_TILE_LAYER, "line-opacity", 0.9);
    }
    // fade out + clear after 1s
    setTimeout(() => {
        try {
            map.setPaintProperty(CLICK_TILE_LAYER, "line-opacity", 0.0);
        } catch { }
    }, 1000);
}


// Simple synth “pop” (no asset needed)
let audioCtx: AudioContext | null = null;
function playPop(isMuted: boolean) {
    if (isMuted) return;
    try {
        audioCtx = audioCtx || new (window.AudioContext || (window as any).webkitAudioContext)();
        const ctx = audioCtx;
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = "triangle";
        o.frequency.value = 420; // start
        const now = ctx.currentTime;
        o.frequency.exponentialRampToValueAtTime(220, now + 0.12);
        g.gain.setValueAtTime(0.0001, now);
        g.gain.exponentialRampToValueAtTime(0.25, now + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);
        o.connect(g).connect(ctx.destination);
        o.start(now); o.stop(now + 0.2);
        // light haptic, if available
        if ("vibrate" in navigator) navigator.vibrate?.(10);
    } catch { }
}

// Replace your snapToTile with this slippy-tile version (zInt = integer zoom)
function snapToTile(lng: number, lat: number, z: number) {
    // use the integer zoom level grid (tiles are defined per integer z)
    const zInt = Math.floor(z + 1e-6);
    const n = Math.pow(2, zInt);

    // tile indices of the tile that CONTAINS the click
    const xt = Math.floor(((lng + 180) / 360) * n);

    const latRad = (lat * Math.PI) / 180;
    const yt = Math.floor(
        (1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2 * n
    );

    // center of that tile
    const centerLng = (xt + 0.5) / n * 360 - 180;
    const nY = Math.PI - (2 * Math.PI * (yt + 0.5)) / n;
    const centerLat = (180 / Math.PI) * Math.atan(0.5 * (Math.exp(nY) - Math.exp(-nY)));

    return { x: xt, y: yt, lng: centerLng, lat: centerLat, zoom: zInt };
}

// Source/layer ids for point placements
const P_SRC = "gp_point_src";
const P_LAYER = "gp_point_layer";

// Image cache: keep track of which icon names we’ve added
const addedImages = new Set<string>();

// Create (or update) one GeoJSON source that holds all point placements
function ensurePointSource(map: any) {
    if (!map.getSource(P_SRC)) {
        map.addSource(P_SRC, {
            type: "geojson",
            data: { type: "FeatureCollection", features: [] },
        });
    }
}

// Create one symbol layer that renders icons from the point source
function ensurePointLayer(map: any) {
    if (!map.getLayer(P_LAYER)) {
        map.addLayer({
            id: P_LAYER,
            type: "symbol",
            source: P_SRC,
            layout: {
                "icon-image": ["get", "icon"],          // per-feature icon name
                "icon-allow-overlap": true,
                "icon-ignore-placement": true,
                "icon-anchor": ["get", "anchor"],       // per-feature anchor
                "icon-size": ["get", "iconSize"],       // per-feature size scalar
            },
        });
    }
}

// Load an external image into the style sprite under a unique name
async function addIconToStyle(map: any, name: string, url: string) {
    if (addedImages.has(name)) return;
    const img = await (await fetch(url, { cache: "force-cache" })).blob();
    const bmp = await createImageBitmap(img);
    if (!map.hasImage(name)) {
        map.addImage(name, bmp, { pixelRatio: 1 });
    }
    addedImages.add(name);
}

async function syncPointPlacements(
    map: any,
    placements: PointPlacement[],
    defaultPixelSize: number
) {
    ensurePointSource(map);
    ensurePointLayer(map);

    // 1) Make sure all icon images are available in the style
    // Use a unique sprite name per placement (e.g., its id)
    for (const p of placements) {
        const iconName = `gp_icon_${p.id}`;
        await addIconToStyle(map, iconName, p.url);
    }

    // 2) Build the feature collection
    const features = placements.map((p) => {
        const iconName = `gp_icon_${p.id}`;
        const px = p.pixelSize ?? defaultPixelSize;

        // Mapbox GL's symbol "icon-size" is a scalar relative to the source image's pixel size at 1x.
        // If you want the image to render at its native pixel size, use 1. To scale, change this.
        const sizeScalar = 1;

        return {
            type: "Feature",
            geometry: { type: "Point", coordinates: [p.lng, p.lat] },
            properties: {
                icon: iconName,
                anchor: p.anchor ?? "bottom",
                iconSize: sizeScalar,
                // you can keep any additional metadata here as needed
            },
        };
    });

    const src = map.getSource(P_SRC) as any;
    src.setData({ type: "FeatureCollection", features });
}

// Build a flag emoji from ISO country code (e.g., "GB" → 🇬🇧)
function flagFromCountryCode(code?: string) {
    if (!code) return undefined;
    const cc = code.trim().toUpperCase();
    if (cc.length !== 2) return undefined;
    const A = 0x1f1e6;
    return String.fromCodePoint(A + (cc.charCodeAt(0) - 65), A + (cc.charCodeAt(1) - 65));
}

// Lightweight reverse geocode via Nominatim (MVP-friendly).
// NOTE: For production, proxy this on your server to respect usage policy & add caching.
async function reverseGeocode(lat: number, lng: number) {
    const url = new URL("https://nominatim.openstreetmap.org/reverse");
    url.searchParams.set("format", "jsonv2");
    url.searchParams.set("lat", String(lat));
    url.searchParams.set("lon", String(lng));
    url.searchParams.set("zoom", "10");        // city/regional precision
    url.searchParams.set("addressdetails", "1");

    const res = await fetch(url.toString(), {
        headers: { "Accept": "application/json" },
    });
    if (!res.ok) throw new Error(`Geocode HTTP ${res.status}`);
    const data = await res.json();

    const addr = data.address || {};
    // Try a few keys that can contain a "city-like" thing
    const city = addr.city || addr.town || addr.village || addr.hamlet || addr.municipality;
    const region = addr.state || addr.region || addr.county;
    const countryName = addr.country;
    const countryCode = (addr.country_code || "").toUpperCase() || undefined;

    return {
        city: city as string | undefined,
        region: region as string | undefined,
        countryName: countryName as string | undefined,
        countryCode,
        countryFlagEmoji: flagFromCountryCode(countryCode),
    };
}

// Snap click to your canvas grid (world-pixel grid at current zoom)
function snapToCanvasGrid(map: any, lng: number, lat: number, zoom: number) {
    const pt = map.project([lng, lat], zoom);      // world px at this zoom
    const gx = Math.round(pt.x / TILE_SIZE);
    const gy = Math.round(pt.y / TILE_SIZE);
    const cx = (gx + 0.5) * TILE_SIZE;
    const cy = (gy + 0.5) * TILE_SIZE;
    const snapped = map.unproject({ x: cx, y: cy }, zoom);
    return { x: gx, y: gy, lng: snapped.lng, lat: snapped.lat, zoom };
}



// === Component ===
type Props = {
    placements: PointPlacement[];
    onClickEmpty: (xy: { lng: number; lat: number }) => void; // ⬅️ changed
    onClickPlacement: (p: PointPlacement) => void;
    sizePx: 128 | 256 | 512;
    onCreate?: () => void;            // ⬅️ new: open prompt drawer
    hasTokens?: boolean;              // ⬅️ new: control disabled state
    cooldownLabel?: string;           // ⬅️ new: e.g. "Out of tokens — regenerates in 2:14"
};

export function MapLibreWorld({ placements, onClickEmpty, onClickPlacement,
    sizePx,
    onCreate,
    hasTokens = true,
    cooldownLabel = "You're out of tokens — regenerates soon",

}: Props) {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const mapRef = useRef<any>(null);
    const center = useMemo<[number, number]>(() => [0, 20], []);
    const indexRef = useRef<Map<string, GridPlacement>>(new Map());

    const [overlaysVisible, setOverlaysVisible] = useState(true);

    // Track what we currently have on the map to avoid churn
    // track gp_* layers to toggle quickly
    const currentIdsRef = useRef<Set<string>>(new Set());
    const currentMetaRef = useRef<Map<string, string>>(new Map());
    const lastSigRef = useRef<string>("");

    // --- checkpoint state ---
    const [checkpoint, setCheckpoint] = useState<Checkpoint | undefined>(undefined);
    const markerRef = useRef<any>(null);  // maplibregl.Marker
    const markerElRef = useRef<HTMLDivElement | null>(null);
    const lastDownRef = useRef<{ x: number; y: number } | null>(null);
    const lastPlacementAtRef = useRef<number>(0);
    const [isMuted, setIsMuted] = useState<boolean>(() => {
        if (typeof window === "undefined") return false;
        return localStorage.getItem(MUTE_KEY) === "1";
    });

    // --- selection modal state ---
    const [selectionTile, setSelectionTile] = useState<TileMeta | null>(null);
    const [selectionOpen, setSelectionOpen] = useState(false);

    // helper for “build meta” (dummy country for now)
    const toTileMeta = (x: number, y: number, z: number): TileMeta => ({
        x, y, zoom: z,
        countryName: undefined,       // MVP: unknown
        countryFlagEmoji: undefined,  // MVP: unknown
        painted: false,               // MVP: assume unpainted
    });

    // share handler
    const shareTile = async (tile: TileMeta) => {
        try {
            const url = new URL(window.location.href);
            url.pathname = "/map";
            url.searchParams.set("x", String(tile.x));
            url.searchParams.set("y", String(tile.y));
            url.searchParams.set("z", String(tile.zoom));
            await navigator.clipboard.writeText(url.toString());
            toast.success("Link copied", { duration: 1800 });
        } catch {
            toast.error("Couldn't copy link");
        }
    };

    // open drawer with coords (Option A)
    const createForTile = (tile: TileMeta) => {
        setSelectionOpen(false);
        // Use your existing “Create” integration:
        // Fire a targeted event with coords, MapPage will open PromptDrawer preset.
        window.dispatchEvent(new CustomEvent("genplace:create:tile", { detail: { x: tile.x, y: tile.y } }));
        // Also fire the generic event if you want to keep both flows working:
        if (!onCreate) window.dispatchEvent(new CustomEvent("genplace:create"));
        onCreate?.();
    };

    useEffect(() => {
        // close modal if user zooms out below threshold
        const map = mapRef.current;
        if (!map) return;
        const onZoomEnd = () => {
            const z = map.getZoom();
            if (z < MIN_INTERACT_ZOOM) setSelectionOpen(false);
        };
        map.on("zoomend", onZoomEnd);
        return () => { map.off("zoomend", onZoomEnd); };
    }, []);


    // Mount map
    useEffect(() => {
        let destroyed = false;
        (async () => {
            const lib = await import("maplibre-gl");
            if (destroyed) return;
            const maplibregl = (lib as any).default ?? lib;
            const map = new maplibregl.Map({
                container: containerRef.current!,
                style: STYLE_URL,
                center, zoom: 3, attributionControl: true,
                pitch: 0, maxPitch: 0, bearing: 0,
                dragRotate: false, pitchWithRotate: false, touchPitch: false,
            });
            mapRef.current = map;

            map.on("load", () => {
                installDeclutterHooks(map);
                map.getCanvas().style.cursor = "grab";
                const maplibregl = (lib as any).default ?? lib;

                // ----- low-zoom visibility gate for gp_* overlays -----
                const syncOverlayVisibilityForZoom = () => {
                    const z = map.getZoom();
                    const allowedByZoom = z >= TILES_VISIBLE_ZOOM;
                    for (const id of currentIdsRef.current) {
                        const layerId = `${id}_layer`;
                        if (map.getLayer(layerId)) {
                            const shouldShow = overlaysVisible && allowedByZoom;
                            map.setPaintProperty(layerId, "raster-opacity", shouldShow ? 1 : 0);
                        }
                    }
                };
                map.on("zoomend", syncOverlayVisibilityForZoom);

                // ----- pointer handlers for click vs drag -----
                map.on("mousedown", (e: any) => {
                    lastDownRef.current = { x: e.point.x, y: e.point.y };
                });

                map.on("click", async (e: any) => {
                    const now = Date.now();
                    if (now - lastPlacementAtRef.current < CLICK_DEBOUNCE_MS) return;

                    // click vs drag
                    const d0 = lastDownRef.current;
                    const moved = d0 ? Math.hypot(e.point.x - d0.x, e.point.y - d0.y) : 0;
                    if (moved > MOVE_TOL_PX) return;

                    const z = map.getZoom();
                    if (z < MIN_INTERACT_ZOOM) {
                        toast.info("You need to zoom in to place.", { duration: 2200, icon: <Info className="h-4 w-4" /> });
                        return;
                    }

                    // RAW click location (what we use for everything now)
                    const clickLng = e.lngLat.lng;
                    const clickLat = e.lngLat.lat;

                    // Place or move the checkpoint pin at the exact click
                    if (!markerRef.current) {
                        const el = makeMarkerElPin("#3B82F6");
                        markerElRef.current = el;
                        const gl = (await import("maplibre-gl")).default;
                        markerRef.current = new gl.Marker({
                            element: el,
                            anchor: "bottom",
                            offset: [0, -7],
                        })
                            .setLngLat([clickLng, clickLat])
                            .addTo(map);
                    } else {
                        markerRef.current.setLngLat([clickLng, clickLat]);
                        const inner = (markerElRef.current as any)?.__inner as HTMLDivElement | undefined;
                        if (inner) {
                            inner.style.transition = "transform 180ms ease";
                            inner.style.transform = "scale(0.92)";
                            requestAnimationFrame(() => { inner.style.transform = "scale(1)"; });
                        }
                    }

                    // If you want a quick blip, keep this (optional)
                    // const gl = (await import("maplibre-gl")).default;
                    // const blipEl = makeClickDotEl();
                    // const blip = new gl.Marker({ element: blipEl, anchor: "center" })
                    //   .setLngLat([clickLng, clickLat]).addTo(map);
                    // setTimeout(() => blip.remove(), 450);

                    // Save checkpoint (point-based now)
                    setCheckpoint({
                        x: NaN, y: NaN,                  // not used anymore — or remove from type
                        lng: clickLng, lat: clickLat,    // ⬅️ exact click
                        zoom: z, placedAt: now,
                    });
                    lastPlacementAtRef.current = now;

                    // Sound + open modal with POINT meta (no more TileMeta)
                    playPop(isMuted);

                    // If SelectionModal currently expects tiles, change its props
                    // e.g., let it accept { lat, lng } instead:
                    setSelectionTile({ x: NaN, y: NaN, zoom: z } as any); // or refactor SelectionModal to a PointSelectionModal
                    setSelectionOpen(true);

                    // Also dispatch a point-based event for create flows
                    window.dispatchEvent(new CustomEvent("genplace:create:point", {
                        detail: { lat: clickLat, lng: clickLng, zoom: z }
                    }));
                });


                // Resize
                const onResize = () => map.resize();
                window.addEventListener("resize", onResize);
                map.once("remove", () => window.removeEventListener("resize", onResize));

                // Keyboard: ESC clears checkpoint
                const onKey = (ev: KeyboardEvent) => {
                    if (ev.key === "Escape") {
                        setCheckpoint(undefined);
                        if (markerRef.current) { markerRef.current.remove(); markerRef.current = null; markerElRef.current = null; }
                    }
                };
                window.addEventListener("keydown", onKey);
                map.once("remove", () => window.removeEventListener("keydown", onKey));

                // initial sync for gp_* opacity vs zoom
                map.once("idle", syncOverlayVisibilityForZoom);
            });

            // prune cache when style changes
            map.on("styledata", () => {
                const style = map.getStyle?.();
                if (!style || !style.sources) return;
                const existing = new Set(Object.keys(style.sources).filter((k) => k.startsWith("gp_")));
                for (const id of currentIdsRef.current) {
                    if (!existing.has(id)) {
                        currentIdsRef.current.delete(id);
                        currentMetaRef.current.delete(id);
                    }
                }
            });
        })();

        return () => {
            destroyed = true;
            if (mapRef.current) {
                mapRef.current.remove();
                mapRef.current = null;
            }
        };
    }, [center]);


    // Deep link: /map?x=&y=&z=
    useEffect(() => {
        if (typeof window === "undefined") return;
        const map = mapRef.current;
        if (!map) return;
        const url = new URL(window.location.href);
        const qx = url.searchParams.get("x");
        const qy = url.searchParams.get("y");
        const qz = url.searchParams.get("z");
        if (!qx || !qy || !qz) return;

        const x = Number(qx), y = Number(qy), z = Number(qz);
        if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) return;

        // derive lat/lng for tile center at z
        const worldPxX = (x + 0.5) * TILE_SIZE;
        const worldPxY = (y + 0.5) * TILE_SIZE;
        const { lng, lat } = map.unproject({ x: worldPxX, y: worldPxY }, z);
        if (z >= MIN_INTERACT_ZOOM) {
            // place marker & center
            setTimeout(() => {
                flySmooth(map, [lng, lat], Math.max(z, MIN_INTERACT_ZOOM + 0.2), { speed: 0.65, curve: 1.35 });
                // place marker after flight begins
                setTimeout(async () => {
                    const el = markerElRef.current ?? makeMarkerElPin();
                    if (!markerRef.current) {
                        const gl = (await import("maplibre-gl")).default;
                        markerRef.current = new gl.Marker({
                            element: el,
                            anchor: "bottom",
                            offset: [0, -7], // <— same lift here
                        })
                            .setLngLat([lng, lat])
                            .addTo(map);
                        markerElRef.current = el;
                    } else {
                        markerRef.current.setLngLat([lng, lat]);
                    }
                    setCheckpoint({ x, y, lng, lat, zoom: z, placedAt: Date.now() });
                }, 250);
            }, 200);
        } else {
            // toast.message("Zoom in to select a tile.");
        }
    }, []);

    // Persist mute setting if you add a toggle later
    useEffect(() => {
        if (typeof window === "undefined") return;
        try { localStorage.setItem(MUTE_KEY, isMuted ? "1" : "0"); } catch { }
    }, [isMuted]);


    // ----------------- placements sync (unchanged, but with zoom-gate) -----------------


    // Sync placements → add/update/remove only what's necessary
    // Cache last placements signature to avoid doing work when nothing changed

    // Sync placements → add/update/remove only what's necessary
    useEffect(() => {
        const map = mapRef.current;
        if (!map || !map.isStyleLoaded?.()) return;

        // Render all point placements as icons
        (async () => {
            try {
                await syncPointPlacements(map, placements, sizePx /* default pixel size */);
            } catch (e) {
                console.error("syncPointPlacements error", e);
            }
        })();
    }, [placements, sizePx]);




    // Toggle visibility across our tracked overlay tiles only (no layer scan)
    useEffect(() => {
        const map = mapRef.current;
        if (!map || !map.isStyleLoaded?.()) return;
        if (map.getLayer(P_LAYER)) {
            map.setLayoutProperty(P_LAYER, "visibility", overlaysVisible ? "visible" : "none");
        }
    }, [overlaysVisible]);



    // Handlers for controls
    const zoomIn = () => mapRef.current?.zoomIn({ duration: 200 });
    const zoomOut = () => mapRef.current?.zoomOut({ duration: 200 });
    const toggleOverlays = () => setOverlaysVisible((v) => !v);
    const showHelp = () => {
        window.alert("Pan/zoom the map. Click an empty tile to place. Toggle overlay to show/hide artwork.");
    };
    const openSocial = () => {
        const url = typeof window !== "undefined" ? window.location.href : "https://genplace.ai";
        const text = encodeURIComponent("Check out the GenPlace collaborative AI canvas!");
        window.open(`https://x.com/intent/tweet?text=${text}%20${encodeURIComponent(url)}`, "_blank");
    };

    // Optional: route or modal for login
    const onLogin = () => {
        // Replace with your auth modal or router push
        window.location.href = "/login";
    };

    // NEW: locate me
    // Locate me -> zoom-out → slide → zoom-in
    // Locate me
    const locateMe = () => {
        if (!("geolocation" in navigator)) {
            window.alert("Geolocation is not supported by your browser.");
            return;
        }
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                const { latitude, longitude } = pos.coords;
                // A local “land” zoom level feels right around 11
                flySmooth(mapRef.current, [longitude, latitude], 11, {
                    speed: 0.7,      // slower & smoother
                    curve: 1.35,     // gentle curve
                    // maxDuration: 2500, // optionally cap long flights
                });
            },
            (err) => {
                console.warn("Geolocation error:", err);
                window.alert("Unable to get your location. Please allow location access in your browser.");
            },
            { enableHighAccuracy: false, maximumAge: 10_000, timeout: 7_000 }
        );
    };

    // Random explorer
    const flyRandom = () => {
        const lat = (Math.random() * 160) - 80;   // -80..+80
        const lng = (Math.random() * 360) - 180;  // -180..+180
        // Regional zoom feels explorative around ~4.5
        flySmooth(mapRef.current, [lng, lat], 4.5, {
            speed: 0.65,   // slightly slower for long hops
            curve: 1.35,
            // maxDuration: 3000,
        });
    };


    return (
        <div ref={containerRef} className="h-dvh w-dvw" style={{ position: "relative" }}>
            {/* Floating control bar (top-left) */}
            <TopLeftControls
                onHelp={showHelp}
                onZoomIn={zoomIn}
                onZoomOut={zoomOut}
                onShare={openSocial}
                overlaysVisible={overlaysVisible}
                onToggleOverlays={toggleOverlays}
            />

            {/* Top-right controls (column) */}
            <TopRightControls onLogin={onLogin}
                onLocateMe={locateMe}
                onRandom={flyRandom}
            />
            {/* Or: <TopRightControls loginHref="/auth" /> */}

            {/* Bottom-center Create button */}
            {/* Bottom-center Create button — hidden when modal is open */}
            {!selectionOpen && (
                <BottomCenterAction
                    label="Create"
                    icon="wand"
                    onClick={onCreate ?? (() => window.dispatchEvent(new CustomEvent("genplace:create")))}
                    disabled={!hasTokens}
                    cooldownText={cooldownLabel}
                    tooltip="Type a prompt → generate → place it on the map"
                />
            )}

            {/* NEW: Bottom-center Selection Modal */}
            <SelectionModal
                open={!!selectionOpen && !!selectionTile}
                onClose={() => setSelectionOpen(false)}
                tile={selectionTile}
                onPrimary={createForTile}
                onShare={shareTile}
                canCreate={!!hasTokens}
                disabledReason={cooldownLabel}
            />
        </div>
    );
}

export { TILE_ZOOM };
