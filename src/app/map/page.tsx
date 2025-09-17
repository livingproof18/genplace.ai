// src/app/map/page.tsx
"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import type { GridPlacement } from "@/components/map/types";

// Dynamically import the Leaflet map (no SSR)
const CanvasMapWorld = dynamic(
    () => import("@/components/map/canvas-map-world").then(m => m.CanvasMapWorld),
    { ssr: false }
);

export default function MapPage() {
    const [selectedEmpty, setSelectedEmpty] = useState<{ x: number; y: number } | null>(null);
    const [details, setDetails] = useState<GridPlacement | null>(null);
    const [size, setSize] = useState<128 | 256 | 512>(256);
    const [placements, setPlacements] = useState<GridPlacement[]>([]);

    const handlePlace = (p: GridPlacement) => {
        setPlacements(prev => [...prev.filter(q => !(q.x === p.x && q.y === p.y && q.z === p.z)), p]);
        setSelectedEmpty(null);
    };

    return (
        // Full-bleed canvas: the map component itself will be fixed to the viewport
        <div className="h-dvh w-screen overflow-hidden">
            <CanvasMapWorld
                sizePx={size}
                placements={placements}
                onClickEmpty={(xy) => setSelectedEmpty(xy)}
                onClickPlacement={(p) => setDetails(p)}
            />

            {/* You can re-enable these later; they'll float above the map if absolutely/fixed positioned */}
            {/* <PromptDrawer tile={selectedEmpty} size={size} onClose={() => setSelectedEmpty(null)} onPlaced={handlePlace} />
      <TileDetailsModal placement={details} onClose={() => setDetails(null)} />
      <OnboardingCoach /> */}
        </div>
    );
}
