// src/app/map/page.tsx
"use client";

import { useState } from "react";
import { SiteHeader } from "@/components/site-header";
import { CanvasMap, GridPlacement } from "@/components/map/canvas-map";
import { Hud } from "@/components/map/hud";
import { PromptDrawer } from "@/components/map/prompt-drawer";
import { TileDetailsModal } from "@/components/map/tile-details-modal";
import { OnboardingCoach } from "@/components/map/onboarding";
// import { Hud } from "@/components/map/hud";

export default function MapPage() {
    // central page state
    const [selectedEmpty, setSelectedEmpty] = useState<{ x: number; y: number } | null>(null);
    const [details, setDetails] = useState<GridPlacement | null>(null);
    const [size, setSize] = useState<128 | 256 | 512>(256);

    // in-memory placements for now (swap with Supabase later)
    const [placements, setPlacements] = useState<GridPlacement[]>([]);

    const handlePlace = (p: GridPlacement) => {
        setPlacements((prev) => [...prev.filter(q => !(q.x === p.x && q.y === p.y)), p]);
        setSelectedEmpty(null);
    };

    return (
        <div className="font-sans">
            <SiteHeader />

            <main className="mx-auto max-w-[1400px] px-4 py-4 grid grid-cols-1 md:grid-cols-[300px_1fr] gap-4">
                {/* Left HUD */}
                <Hud size={size} onSizeChange={setSize} />

                {/* Map */}
                <section className="relative rounded-xl border overflow-hidden">
                    <CanvasMap
                        sizePx={size}
                        placements={placements}
                        onClickEmpty={(xy) => setSelectedEmpty(xy)}
                        onClickPlacement={(p) => setDetails(p)}
                    />
                </section>
            </main>

            {/* Right Drawer for prompt / placement */}
            <PromptDrawer
                tile={selectedEmpty}
                size={size}
                onClose={() => setSelectedEmpty(null)}
                onPlaced={handlePlace}
            />

            {/* Details modal */}
            <TileDetailsModal placement={details} onClose={() => setDetails(null)} />

            {/* Onboarding */}
            <OnboardingCoach />
        </div>
    );
}
