export type Style =
    | "auto"
    | "cinematic"
    | "anime"
    | "oil"
    | "watercolor"
    | "pixel"
    | "3d"
    | "comic"
    | "minimal"
    | "neon";

export const STYLE_PRESETS: Record<Style, { label: string; prefix: string; suffix?: string }> = {
    auto: {
        label: "Auto",
        prefix: "",
    },
    cinematic: {
        label: "Cinematic",
        prefix: "cinematic lighting, dramatic composition, high detail, ",
    },
    anime: {
        label: "Anime",
        prefix: "anime style illustration, clean line art, vibrant colors, ",
    },
    oil: {
        label: "Oil Painting",
        prefix: "oil painting, visible brush strokes, classical art style, ",
    },
    watercolor: {
        label: "Watercolor",
        prefix: "watercolor painting, soft washes, flowing pigments, ",
    },
    pixel: {
        label: "Pixel Art",
        prefix: "pixel art, 16-bit retro style, low resolution, ",
    },
    "3d": {
        label: "3D Render",
        prefix: "3D render, global illumination, realistic materials, ",
    },
    comic: {
        label: "Comic Book",
        prefix: "comic book style, bold outlines, halftone shading, ",
    },
    minimal: {
        label: "Minimalist",
        prefix: "minimalist design, simple shapes, limited color palette, ",
    },
    neon: {
        label: "Neon",
        prefix: "neon colors, cyberpunk aesthetic, glowing highlights, ",
    },
};

export function applyStyle(prompt: string, style: Style): string {
    if (style === "auto") return prompt;
    const preset = STYLE_PRESETS[style];
    return `${preset.prefix}${prompt}${preset.suffix ?? ""}`;
}
