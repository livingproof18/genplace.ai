// A placement anchored at an exact lat/lng (no grid)
export type PointPlacement = {
  id: string; // stable ID for this artwork (e.g., server id or hash)
  url: string; // image URL
  lat: number;
  lng: number;
  pixelSize?: number; // optional: desired pixel size for the icon (default 256)
  anchor?:
    | "center"
    | "bottom"
    | "top"
    | "left"
    | "right"
    | "bottom-left"
    | "bottom-right"
    | "top-left"
    | "top-right";
};

export type Model =
  | "openai-1"
  | "openai-1.5"
  | "google-flash"
  | "google-pro"
  | "sdxl";
export type Size = 24 | 48 | 64 | 96 | 128 | 256 | 384 | 512;
