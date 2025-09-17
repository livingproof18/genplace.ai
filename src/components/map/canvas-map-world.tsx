// src/components/map/canvas-map-world.tsx
"use client";

import "leaflet/dist/leaflet.css";
import { MapContainer, TileLayer, ImageOverlay, useMap, useMapEvents } from "react-leaflet";
import { useEffect, useMemo } from "react";
import type { GridPlacement } from "./types";

const TILE_ZOOM = 5;

// Slippy helpers
function lon2tile(lon: number, z: number) {
    return Math.floor(((lon + 180) / 360) * Math.pow(2, z));
}
function lat2tile(lat: number, z: number) {
    const rad = (lat * Math.PI) / 180;
    return Math.floor(
        ((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * Math.pow(2, z)
    );
}
function tile2lon(x: number, z: number) {
    return (x / Math.pow(2, z)) * 360 - 180;
}
function tile2lat(y: number, z: number) {
    const n = Math.PI - (2 * Math.PI * y) / Math.pow(2, z);
    return (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
}

function ClickCatcher({
    onClickEmpty,
    onClickPlacement,
    placements,
}: {
    onClickEmpty: (xy: { x: number; y: number }) => void;
    onClickPlacement: (p: GridPlacement) => void;
    placements: GridPlacement[];
}) {
    useMapEvents({
        click(e) {
            const x = lon2tile(e.latlng.lng, TILE_ZOOM);
            const y = lat2tile(e.latlng.lat, TILE_ZOOM);
            const hit = placements.find((p) => p.x === x && p.y === y && p.z === TILE_ZOOM);
            if (hit) onClickPlacement(hit);
            else onClickEmpty({ x, y });
        },
    });
    return null;
}

// Keep Leaflet sized correctly on ready and window resize
function InvalidateOnResize() {
    const map = useMap();
    useEffect(() => {
        const rerender = () => map.invalidateSize();
        map.whenReady(rerender);
        window.addEventListener("resize", rerender);
        return () => window.removeEventListener("resize", rerender);
    }, [map]);
    return null;
}

export function CanvasMapWorld({
    placements,
    onClickEmpty,
    onClickPlacement,
    sizePx,
}: {
    placements: GridPlacement[];
    onClickEmpty: (xy: { x: number; y: number }) => void;
    onClickPlacement: (p: GridPlacement) => void;
    sizePx: 128 | 256 | 512;
}) {
    const center: [number, number] = useMemo(() => [20, 0], []);
    const startZoom = 3;

    return (
        // Fixed to viewport — the map always fills the screen
        <div className="fixed inset-0">
            <MapContainer
                center={center}
                zoom={startZoom}
                minZoom={2}
                maxZoom={18}
                // IMPORTANT: the container must have explicit size
                style={{ width: "100%", height: "100%" }}
                className="bg-background touch-pan-x touch-pan-y"
            >
                <TileLayer
                    // You can swap this URL for another provider (MapTiler, Mapbox, etc.)
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />

                {placements.map((p, i) => {
                    const west = tile2lon(p.x, p.z);
                    const east = tile2lon(p.x + 1, p.z);
                    const north = tile2lat(p.y, p.z);
                    const south = tile2lat(p.y + 1, p.z);
                    const bounds: [[number, number], [number, number]] = [[south, west], [north, east]];
                    return (
                        <ImageOverlay
                            key={`${p.x}-${p.y}-${p.z}-${i}`}
                            url={p.url}
                            bounds={bounds}
                            opacity={1}
                        />
                    );
                })}

                <ClickCatcher
                    placements={placements}
                    onClickEmpty={onClickEmpty}
                    onClickPlacement={onClickPlacement}
                />
                <InvalidateOnResize />
            </MapContainer>
        </div>
    );
}
