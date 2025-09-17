// src/components/map/types.ts
export type GridPlacement = {
  // Slippy tile coords at a fixed zoom (z)
  x: number;
  y: number;
  z: number; // tile zoom level used for indexing
  url: string;
  prompt: string;
  author?: string;
  size: 128 | 256 | 512;
  placedAt: string; // ISO
};
