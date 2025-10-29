// src/components/map/maplibre-world.tsx
"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { TopLeftControls } from "./top-left-controls";
import { TopRightControls } from "./top-right-controls"; // ⬅️ add this import
import { BottomCenterAction } from "./bottom-center-action";
import { toast } from "sonner";
import { SelectionModal, type TileMeta } from "./selection-modal";
import { Info } from "lucide-react";
import { createPortal } from "react-dom"; // <- ADD
import { cn } from "@/lib/utils";

// ---- CONFIG ----
const TILE_ZOOM = 5;
const STYLE_URL = "https://tiles.openfreemap.org/styles/liberty";
// ----------------
// === Checkpoint spec constants (MapLibre/GL) ===
const TILE_SIZE = 256;                 // your canvas/generation tile size
const MIN_INTERACT_ZOOM = 11.0;        // block tagging below this
const TILES_VISIBLE_ZOOM = 11.0;       // hide gp_* overlays below this
const CLICK_DEBOUNCE_MS = 250;
const MOVE_TOL_PX = 5;                 // dragging vs click

// Geolocation cache key + TTL (ms). Keep cached loc for e.g. 24h (86400000 ms)
const GEO_CACHE_KEY = "genplace:geo_cache_v1";
const GEO_CACHE_TTL = 14 * 24 * 60 * 60 * 1000; // 2 weeks

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


// A *display-only* global pixel grid like wplace (huge resolution).
// MapLibre's world size at zoom Z is 512 * 2^Z pixels.
// Z=22 → 2,147,483,648 px per axis (~4.6e18 cells total) — plenty high.
const CANVAS_PIXEL_Z = 22;

// lat/lng → global canvas pixel (integer) at CANVAS_PIXEL_Z
function latLngToCanvasPixel(map: any, lng: number, lat: number) {
    const p = map.project([lng, lat], CANVAS_PIXEL_Z);
    // floor to get a single pixel cell id; no snapping of the marker!
    return { x: Math.floor(p.x), y: Math.floor(p.y), gridZ: CANVAS_PIXEL_Z };
}


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
  .gp-pin-dot  { position: absolute; left: 50%; bottom: 0; width: 8px; height: 8px;
                 transform: translateX(-50%); border-radius: 9999px; background: rgb(59,130,246);
                 box-shadow: 0 6px 12px rgba(59,130,246,.35); }
  .gp-pin-pulse{ position: absolute; left: 50%; bottom: 0; width: 8px; height: 8px;
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

// Helper: read/write geolocation cache
function readGeoCache(): { lat: number; lng: number; ts: number } | null {
    try {
        const raw = localStorage.getItem(GEO_CACHE_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed.ts !== "number") return null;
        if (Date.now() - parsed.ts > GEO_CACHE_TTL) {
            localStorage.removeItem(GEO_CACHE_KEY);
            return null;
        }
        if (typeof parsed.lat === "number" && typeof parsed.lng === "number") return parsed;
        return null;
    } catch {
        return null;
    }
}
function writeGeoCache(lat: number, lng: number) {
    try {
        localStorage.setItem(GEO_CACHE_KEY, JSON.stringify({ lat, lng, ts: Date.now() }));
    } catch { }
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

// Build a flag emoji from ISO country code (e.g., "GB" → 🇬🇧).
// If the runtime cannot render an emoji (very rare), this returns undefined.
function flagFromCountryCode(code?: string) {
    if (!code) return undefined;
    const cc = code.trim().toUpperCase();
    if (cc.length !== 2) return undefined;
    const A = 0x1f1e6;
    try {
        return String.fromCodePoint(A + (cc.charCodeAt(0) - 65), A + (cc.charCodeAt(1) - 65));
    } catch {
        return undefined;
    }
}

// Lightweight reverse geocode via Nominatim (MVP-friendly).
// NOTE: For production, proxy this on your server to respect usage policy & add caching.
async function reverseGeocode(lat: number, lng: number, signal?: AbortSignal) {
    // Build request to Nominatim. We use "jsonv2" which gives structured address details.
    const url = new URL("https://nominatim.openstreetmap.org/reverse");
    url.searchParams.set("format", "jsonv2");
    url.searchParams.set("lat", String(lat));
    url.searchParams.set("lon", String(lng));
    // zoom 10 is a reasonable regional granularity; response contains address fields
    url.searchParams.set("zoom", "10");
    url.searchParams.set("addressdetails", "1");

    // NOTE: Browsers won't let you set a custom User-Agent. The referer header
    // will typically be sent automatically. For production, proxy this request
    // on your server and set a clear User-Agent/contact there.
    const res = await fetch(url.toString(), {
        headers: { "Accept": "application/json" },
        signal,
    });
    if (!res.ok) {
        // don't throw raw network code into UI; return graceful fallback
        throw new Error(`Geocode HTTP ${res.status}`);
    }
    const data = await res.json();

    // Nominatim returns 'address' with many fields. Take the most specific city-like field.
    const addr = data?.address || {};

    // Pick a concise shortName/displayName for UI:
    // Prefer city > town > village > municipality > hamlet > county > state > country
    const city =
        addr.city ||
        addr.town ||
        addr.village ||
        addr.municipality ||
        addr.hamlet ||
        addr.suburb; // sometimes suburb holds the neighborhood/city name

    const county = addr.county;
    const state = addr.state || addr.region;
    const countryName = addr.country;
    const countryCode = (addr.country_code || "").toUpperCase() || undefined;

    // Build a short display name that is just the most relevant label (city or county or state)
    const displayName =
        (city && city.trim()) ||
        (county && county.trim()) ||
        (state && state.trim()) ||
        (countryName && countryName.trim()) ||
        "";

    // Emoji may not render in some environments; return a fallback to the 2-letter code
    const flagEmoji = countryCode ? flagFromCountryCode(countryCode) : undefined;
    const countryFlagEmoji = flagEmoji ?? undefined;

    return {
        // structured pieces (if you want them)
        city: city || undefined,
        region: state || undefined,
        county: county || undefined,
        countryName: countryName || undefined,
        countryCode,
        // short display string for UI (e.g., "London")
        displayName,
        // the emoji (if available)
        countryFlagEmoji,
    };
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
    label?: string;                   // ⬅️ new: e.g. "Create 1/5"
};


export function MapLibreWorld({ placements, onClickEmpty, onClickPlacement,
    sizePx,
    onCreate,
    hasTokens = true,
    cooldownLabel = "You're out of tokens — regenerates soon",
    label = "Create",

}: Props) {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const mapRef = useRef<any>(null);
    const center = useMemo<[number, number]>(() => [0, 20], []);

    const [overlaysVisible, setOverlaysVisible] = useState(true);

    // --- hint: show when user is too zoomed out ---
    const [showZoomHint, setShowZoomHint] = useState(false);


    // Geolocation cache key + TTL (ms). Keep cached loc for e.g. 24h (86400000 ms)
    const GEO_CACHE_KEY = "genplace:geo_cache_v1";
    const GEO_CACHE_TTL = 24 * 60 * 60 * 1000; // 24h


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

    // near other refs at top of component
    const geocodeAbortRef = useRef<AbortController | null>(null);
    const selectionSeqRef = useRef(0); // increases each click; latest wins


    // share handler
    // share handler -> returns share url + optional snapshot blob
    // Helper: wait for map to be idle (or timeout)
    function waitForMapIdle(map: any, timeout = 1200): Promise<void> {
        return new Promise((resolve) => {
            if (!map) return resolve();
            let done = false;
            const onIdle = () => {
                if (done) return;
                done = true;
                try { map.off("idle", onIdle); } catch { }
                resolve();
            };
            try {
                map.once("idle", onIdle);
            } catch {
                // if once fails, just resolve after timeout
            }
            // safety timeout
            setTimeout(() => {
                if (done) return;
                done = true;
                try { map.off("idle", onIdle); } catch { }
                resolve();
            }, timeout);
        });
    }



    // Create a tiny white PNG blob as a guaranteed fallback
    async function createBlankImageBlob(w = 2, h = 2, color = "#ffffff"): Promise<Blob> {
        const c = document.createElement("canvas");
        c.width = w;
        c.height = h;
        const ctx = c.getContext("2d");
        if (!ctx) {
            // Last resort empty blob
            return new Blob([], { type: "image/png" });
        }
        ctx.fillStyle = color;
        ctx.fillRect(0, 0, w, h);
        return await new Promise<Blob>((resolve) => c.toBlob((b) => resolve(b || new Blob([], { type: "image/png" })), "image/png"));
    }

    /**
     * captureMapSnapshot:
     * - draws any <img> descendants of the map container (tiles/raster images),
     * - then draws the WebGL canvas on top.
     * - returns a PNG blob (or a small white PNG fallback if encoding fails).
     */
    async function captureMapSnapshot(map: any, opts?: { opaqueBg?: string }): Promise<Blob | null> {
        if (!map) return null;

        // brief settle
        await new Promise(requestAnimationFrame);
        await new Promise(requestAnimationFrame);

        const glCanvas: HTMLCanvasElement = map.getCanvas?.();
        if (!glCanvas || !glCanvas.width || !glCanvas.height) return null;

        // map container element & bounding box (CSS px)
        const container: HTMLElement = map.getContainer?.() ?? glCanvas.parentElement ?? glCanvas;
        const containerRect = container.getBoundingClientRect();

        const w = glCanvas.width; // device pixels
        const h = glCanvas.height;

        // CSS -> device pixel scale
        const scale = w / Math.max(1, containerRect.width);

        const off = document.createElement("canvas");
        off.width = w;
        off.height = h;
        const ctx = off.getContext("2d", { alpha: true });
        if (!ctx) {
            return await createBlankImageBlob();
        }

        // optional opaque background
        if (opts?.opaqueBg) {
            ctx.save();
            ctx.fillStyle = opts.opaqueBg;
            ctx.fillRect(0, 0, w, h);
            ctx.restore();
        }

        // Draw DOM images (tiles or other imgs) that live in the map container
        try {
            const imgs = Array.from(container.querySelectorAll("img")) as HTMLImageElement[];
            for (const img of imgs) {
                try {
                    if (!img.complete || img.naturalWidth === 0) continue;
                    const r = img.getBoundingClientRect();
                    // coordinates relative to container top-left (CSS px)
                    const xCss = r.left - containerRect.left;
                    const yCss = r.top - containerRect.top;
                    const wCss = r.width;
                    const hCss = r.height;
                    const x = Math.round(xCss * scale);
                    const y = Math.round(yCss * scale);
                    const iw = Math.round(wCss * scale);
                    const ih = Math.round(hCss * scale);

                    // draw the image to the offscreen canvas
                    ctx.drawImage(img, 0, 0, img.naturalWidth, img.naturalHeight, x, y, iw, ih);
                } catch (e) {
                    console.warn("[snapshot] drawing map img failed", e, img);
                }
            }
        } catch (e) {
            console.warn("[snapshot] querySelectorAll('img') failed", e);
        }

        // Draw WebGL canvas content on top (vector layers, overlays rendered to GL)
        try {
            ctx.drawImage(glCanvas, 0, 0, w, h);
        } catch (e) {
            console.warn("[snapshot] drawImage(glCanvas) failed", e);
            // continue — we might have drawn some imgs already
        }

        // Try to encode to PNG
        try {
            const blob: Blob | null = await new Promise((resolve) => off.toBlob((b) => resolve(b), "image/png"));
            if (!blob || blob.size < 32) {
                // suspiciously small — return a blank white image as guaranteed fallback
                return await createBlankImageBlob(w > 0 ? Math.min(w, 1024) : 2, h > 0 ? Math.min(h, 1024) : 2, opts?.opaqueBg ?? "#ffffff");
            }
            return blob;
        } catch (err) {
            console.warn("[snapshot] toBlob failed", err);
            return await createBlankImageBlob();
        }
    }

    /**
     * shareTile: builds the share URL and returns an image blob (always returns a blob fallback if snapshot fails)
     */
    const shareTile = async (tile: TileMeta): Promise<{ shareUrl: string; imageBlob?: Blob | null }> => {
        // Build share URL
        const url = new URL(window.location.href);
        url.pathname = "/map";
        url.searchParams.set("z", String(tile.zoom));
        if (tile.lat != null && tile.lng != null) {
            url.searchParams.set("lat", tile.lat.toFixed(6));
            url.searchParams.set("lng", tile.lng.toFixed(6));
        }
        // url.searchParams.set("px", String(tile.x));
        // url.searchParams.set("py", String(tile.y));

        let finalBlob: Blob | null = null;
        try {
            // primary: compositing snapshot
            finalBlob = await captureMapSnapshot(mapRef.current, { opaqueBg: "#ffffff" });
        } catch (err) {
            console.warn("[share] captureMapSnapshot failed", err);
            finalBlob = null;
        }

        // guaranteed fallback: blank white PNG
        if (!finalBlob) {
            finalBlob = await createBlankImageBlob(2, 2, "#ffffff");
        }

        return { shareUrl: url.toString(), imageBlob: finalBlob };
    };


    // open drawer with coords (Option A)
    const createForTile = (tile: TileMeta) => {
        setSelectionOpen(false);
        // Tile-first path: open the drawer WITH a preset point (lat/lng).
        // MapPage already listens for this and sets presetPoint  opens the drawer.
        if (tile.lat != null && tile.lng != null) {
            window.dispatchEvent(
                new CustomEvent("genplace:create:point", { detail: { lat: tile.lat, lng: tile.lng } })
            );
        }
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

    useEffect(() => {
        return () => {
            try {
                geocodeAbortRef.current?.abort();
            } catch (err) {
                // Defensive: abort shouldn't throw but guard anyway
                console.warn("geocode abort threw:", err);
            } finally {
                geocodeAbortRef.current = null;
            }
        };
    }, []);


    // add this near other handlers
    const clearSelection = useCallback(() => {
        // close the modal
        setSelectionOpen(false);
        setSelectionTile(null);

        // remove the marker + checkpoint
        setCheckpoint(undefined);
        if (markerRef.current) {
            markerRef.current.remove();
            markerRef.current = null;
            markerElRef.current = null;
        }
    }, []);

    // wire ESC to the single clear function
    useEffect(() => {
        const onKey = (ev: KeyboardEvent) => {
            if (ev.key === "Escape") clearSelection();
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [clearSelection]);

    // Keep hint in sync with zoom level
    // useEffect(() => {
    //     const map = mapRef.current;
    //     if (!map) return;
    //     const syncHint = () => setShowZoomHint(map.getZoom() < MIN_INTERACT_ZOOM);
    //     // run once + on zoom
    //     syncHint();
    //     map.on("zoom", syncHint);
    //     return () => map.off("zoom", syncHint);
    // }, []);


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
                // IMPORTANT: keep pixels readable for toBlob / toDataURL
                preserveDrawingBuffer: true,
                antialias: true,
            });
            mapRef.current = map;

            map.on("load", () => {
                installDeclutterHooks(map);
                map.getCanvas().style.cursor = "grab";
                map.doubleClickZoom?.disable();
                const maplibregl = (lib as any).default ?? lib;

                // Deep link: ?lat=&lng=&zoom=
                try {
                    const url = new URL(window.location.href);
                    const qLat = parseFloat(url.searchParams.get("lat") || "");
                    const qLng = parseFloat(url.searchParams.get("lng") || "");
                    const qZoom = parseFloat(url.searchParams.get("zoom") || "");

                    if (Number.isFinite(qLat) && Number.isFinite(qLng)) {
                        const targetZoom = Number.isFinite(qZoom) ? qZoom : Math.max(MIN_INTERACT_ZOOM, 10.5);
                        map.jumpTo({ center: [qLng, qLat], zoom: targetZoom });
                    }
                } catch { }

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

                // Sync overlay visibility on zoom
                // --- top-center hint sync (run after map exists) ---
                const syncHint = () => {
                    try {
                        setShowZoomHint(map.getZoom() < MIN_INTERACT_ZOOM);
                    } catch {
                        // ignore if getZoom fails for some reason
                    }
                };
                // run once now that map exists
                syncHint();
                // update on zoom (and hide on moveend if you prefer)
                map.on("zoom", syncHint);

                // ensure we remove the listener when the map is removed
                map.once("remove", () => {
                    try { map.off("zoom", syncHint); } catch { }
                });



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

                    // 1) EXACT click (no snapping)
                    const clickLng = e.lngLat.lng;
                    const clickLat = e.lngLat.lat;

                    // 2) Place or move the pin exactly where the user clicked
                    if (!markerRef.current) {
                        const el = makeMarkerElPin("#3B82F6");
                        markerElRef.current = el;
                        const gl = (await import("maplibre-gl")).default;
                        markerRef.current = new gl.Marker({ element: el, anchor: "bottom", })
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

                    // 3) Save checkpoint (kept for your state/debug)
                    setCheckpoint({
                        x: NaN, y: NaN,                // (unused now)
                        lng: clickLng, lat: clickLat,
                        zoom: z, placedAt: now,
                    });
                    lastPlacementAtRef.current = now;
                    playPop(isMuted);

                    // 4) Compute *display-only* canvas pixel (no effect on pin)
                    const px = latLngToCanvasPixel(map, clickLng, clickLat); // {x,y,gridZ}

                    // 5) Build initial modal meta; enrich with reverse geocode
                    let meta: TileMeta = {
                        x: px.x,
                        y: px.y,
                        zoom: Math.floor(z),   // UI zoom (not the gridZ)
                        lat: clickLat,
                        lng: clickLng,
                        painted: false,
                    };
                    setSelectionTile(meta);
                    setSelectionOpen(true);

                    // before doing any async work, bump the selection sequence
                    const seq = ++selectionSeqRef.current;

                    // cancel any in-flight geocode
                    geocodeAbortRef.current?.abort();
                    geocodeAbortRef.current = new AbortController();

                    // ... you already built initial meta and setSelectionTile(meta); setSelectionOpen(true);


                    try {
                        const loc = await reverseGeocode(clickLat, clickLng, geocodeAbortRef.current.signal);
                        // Only apply if this is still the newest selection (no newer clicks happened)
                        if (seq === selectionSeqRef.current) {
                            setSelectionTile(prev => prev ? { ...prev, ...loc } : prev);
                        }
                    } catch (err: any) {
                        // Ignore aborts; log other errors
                        if (err?.name !== "AbortError") console.warn("reverseGeocode failed", err);
                    }


                    // Optional: trigger “create” flow (point-based)
                    // window.dispatchEvent(new CustomEvent("genplace:create:point", {
                    //     detail: { lat: clickLat, lng: clickLng, zoom: z, pixelX: px.x, pixelY: px.y, gridZ: px.gridZ }
                    // }));
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

    // Render top-center hint into document.body so it cannot be occluded by map stacking contexts
    function ZoomHintPortal() {
        if (typeof window === "undefined") return null;
        const content = (
            <div
                aria-live="polite"
                style={{ position: "fixed", left: "50%", top: 16, transform: "translateX(-50%)", zIndex: 99999 }}
                className={`
        transition-opacity duration-200
        ${showZoomHint ? "opacity-100" : "opacity-0 pointer-events-none"}
      `}
            >

                <button
                    onClick={() => {
                        zoomToInteract();
                    }}
                    className={cn(
                        "flex items-center gap-2 rounded-full px-4 h-9 transition-colors shadow-md",
                        "bg-background/90 backdrop-blur border border-border text-foreground",
                        "hover:bg-background/95 active:bg-background"
                    )}
                    aria-label="Zoom in to see pixels"
                >
                    <Info className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                    <span className="text-[13px] font-medium">Zoom in to see the pixels</span>
                </button>

            </div>
        );
        return createPortal(content, document.body);
    }


    const zoomToInteract = () => {
        const map = mapRef.current;
        if (!map) return;
        const target = Math.max(MIN_INTERACT_ZOOM, 11);
        // quick ease so user sees immediate motion
        map.easeTo({ zoom: target, duration: 320, easing: easeInOutCubic });
        // hide hint right away for best UX (map zoom event will also update state)
        setShowZoomHint(false);
    };





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

    const locateMe = () => {
        const map = mapRef.current;
        if (!map) {
            window.alert("Map not ready yet.");
            return;
        }
        if (!("geolocation" in navigator)) {
            window.alert("Geolocation is not supported by your browser.");
            return;
        }

        // 1) If we have a cached (recent) location, use it immediately for instant feel
        const cached = readGeoCache();
        const instantTargetZoom = Math.max(MIN_INTERACT_ZOOM, 11);

        if (cached) {
            // immediate feedback: fly to cached coordinates
            map.flyTo({
                center: [cached.lng, cached.lat],
                zoom: instantTargetZoom,
                speed: 1.25,
                curve: 1.35,
                essential: true,
            });
            // still try to refresh from actual geolocation in background to update cache
            navigator.geolocation.getCurrentPosition(
                (pos) => {
                    writeGeoCache(pos.coords.latitude, pos.coords.longitude);
                    // if position differs significantly from cache, fly to true position
                    const lat = pos.coords.latitude, lng = pos.coords.longitude;
                    const dist = Math.hypot(lat - cached.lat, lng - cached.lng);
                    if (dist > 0.001) { // small threshold to avoid tiny hops
                        map.flyTo({ center: [lng, lat], zoom: instantTargetZoom, speed: 1.0, curve: 1.35, essential: true });
                    }
                },
                () => { /* ignore background geolocation errors */ },
                { enableHighAccuracy: false, maximumAge: 30_000, timeout: 4_000 }
            );
            return;
        }

        // 2) If no cache, give instant zoom feedback, then request geolocation
        if ((map.getZoom?.() ?? 0) < instantTargetZoom) {
            map.easeTo({ zoom: instantTargetZoom, duration: 300, easing: easeInOutCubic });
        }

        navigator.geolocation.getCurrentPosition(
            (pos) => {
                const { latitude, longitude } = pos.coords;
                writeGeoCache(latitude, longitude);
                map.flyTo({
                    center: [longitude, latitude],
                    zoom: Math.max(map.getZoom() ?? instantTargetZoom, instantTargetZoom),
                    speed: 1.0,
                    curve: 1.35,
                    essential: true,
                });
            },
            (err) => {
                console.warn("Geolocation error:", err);
                // keep UX graceful: inform user but don't spam
                window.alert("Couldn't get your live position. Ensure you have granted location access.");
            },
            { enableHighAccuracy: false, maximumAge: 30_000, timeout: 4_000 }
        );
    };


    // Random explorer
    const flyRandom = () => {
        const lat = (Math.random() * 160) - 80;
        const lng = (Math.random() * 360) - 180;
        const targetZoom = Math.max(MIN_INTERACT_ZOOM, 11);

        // Trigger a short immediate ease for instant motion feedback, then start the smooth flight.
        const map = mapRef.current;
        if (map) {
            // small quick nudge so user sees movement right away
            map.easeTo({ zoom: Math.min(targetZoom, (map.getZoom?.() ?? targetZoom) + 0.6), duration: 220, easing: easeInOutCubic });
        }

        // then perform the main flight; make speed higher so flight starts snappier
        flySmooth(mapRef.current, [lng, lat], targetZoom, {
            speed: 1.5,   // larger => faster overall travel time (MapLibre uses higher=quicker)
            curve: 1.25,
            // consider maxDuration if you want to cap very long hops
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
            <TopRightControls
                user={{ name: "Alice Johnson" }}
                onLogin={onLogin}
                onLocateMe={locateMe}
                onRandom={flyRandom}
            />
            {/* Or: <TopRightControls loginHref="/auth" /> */}

            {/* Top-center zoom hint */}
            {/* Portal for top-center zoom hint so it sits above map (avoids stacking-context issues) */}
            {typeof window !== "undefined" && <ZoomHintPortal />}

            {/* Bottom-center Create button — hidden when modal is open */}
            {!selectionOpen && (
                <BottomCenterAction
                    label={label ?? "Create"}
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
                onClose={clearSelection}    // ⬅️ important
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
