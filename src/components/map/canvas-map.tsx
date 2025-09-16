// src/components/map/canvas-map.tsx
"use client";

import "leaflet/dist/leaflet.css";
import { MapContainer, ImageOverlay, useMapEvents } from "react-leaflet";
import L, { type LeafletMouseEvent } from "leaflet";
import { useMemo } from "react";
import { cn } from "@/lib/utils";

export type GridPlacement = {
    x: number; // tile coords
    y: number;
    url: string;
    prompt: string;
    author?: string;
    size: 128 | 256 | 512;
    placedAt: string; // ISO
};

const GRID = { cols: 30, rows: 30 };
const TILE_PX = 128;

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
        click(e: LeafletMouseEvent) {
            const x = Math.floor(e.latlng.lng / TILE_PX);
            const y = Math.floor(e.latlng.lat / TILE_PX);
            if (x < 0 || y < 0 || x >= GRID.cols || y >= GRID.rows) return;
            const hit = placements.find((p) => p.x === x && p.y === y);
            if (hit) onClickPlacement(hit);
            else onClickEmpty({ x, y });
        },
    });
    return null;
}

export function CanvasMap({
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
    const world = useMemo(
        () => [GRID.rows * TILE_PX, GRID.cols * TILE_PX] as const,
        []
    );

    return (
        <div className="relative w-full h-[72vh] md:h-[78vh]">
            <MapContainer
                crs={L.CRS.Simple}
                bounds={[[0, 0], [world[0], world[1]]]}
                center={[world[0] / 2, world[1] / 2]}
                zoom={-1}
                minZoom={-4}
                maxZoom={2}
                style={{ width: "100%", height: "100%" }}
                className="bg-background"
            >
                {/* subtle grid background using data URL */}

                {/* placed images */}
                {placements.map((p, i) => {
                    <ImageOverlay
                        url={`data:image/svg+xml;utf8,${encodeURIComponent(gridSVG(GRID.cols, GRID.rows, TILE_PX))}`}
                        bounds={[[0, 0], [world[0], world[1]]]}
                        opacity={0.35}
                    />
                    const x0 = p.x * TILE_PX;
                    const y0 = p.y * TILE_PX;
                    const x1 = x0 + TILE_PX;
                    const y1 = y0 + TILE_PX;
                    return (
                        <ImageOverlay
                            key={`${p.x}-${p.y}-${i}`}
                            url={p.url}
                            bounds={[[y0, x0], [y1, x1]]}
                            className={cn("rounded-sm")}
                        />
                    );
                })}

                <ClickCatcher
                    placements={placements}
                    onClickEmpty={onClickEmpty}
                    onClickPlacement={onClickPlacement}
                />
            </MapContainer>
        </div>
    );
}

function gridSVG(cols: number, rows: number, tile: number) {
    const w = cols * tile;
    const h = rows * tile;
    return `
  <svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
    <defs>
      <pattern id="p" width="${tile}" height="${tile}" patternUnits="userSpaceOnUse">
        <rect width="${tile}" height="${tile}" fill="rgb(12,12,12)"/>
        <rect x="0" y="0" width="${tile}" height="${tile}" fill="none" stroke="rgba(255,255,255,0.08)" stroke-width="1"/>
      </pattern>
    </defs>
    <rect width="100%" height="100%" fill="url(#p)"/>
  </svg>`;
}
