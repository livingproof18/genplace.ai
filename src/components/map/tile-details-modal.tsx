// src/components/map/tile-details-modal.tsx
"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { GridPlacement } from "./types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export function TileDetailsModal({
    placement,
    onClose,
}: {
    placement: GridPlacement | null;
    onClose: () => void;
}) {
    return (
        <Dialog open={!!placement} onOpenChange={(v) => !v && onClose()}>
            <DialogContent className="sm:max-w-[560px]">
                {placement && (
                    <>
                        <DialogHeader>
                            <DialogTitle>
                                Tile ({placement.x}, {placement.y})
                            </DialogTitle>
                        </DialogHeader>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={placement.url} alt="tile" className="rounded-lg border w-full" />
                        <div className="space-y-2">
                            <div className="text-sm">
                                <span className="font-medium">Prompt:</span>{" "}
                                <span className="text-muted-foreground">{placement.prompt}</span>
                            </div>
                            <div className="text-xs text-muted-foreground">
                                Placed {new Date(placement.placedAt).toLocaleString()}
                            </div>
                            <Badge variant="secondary" className="rounded-xl">{placement.size}×{placement.size}</Badge>
                            <div className="pt-2">
                                <Button variant="secondary" className="rounded-xl" onClick={() => alert("Reported (stub)")}>
                                    Report
                                </Button>
                            </div>
                        </div>
                    </>
                )}
            </DialogContent>
        </Dialog>
    );
}
