"use client";

import * as React from "react";
import { X, MapPin, Wand2, Share2, Image as ImageIcon, Copy } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTheme } from "next-themes";
import { createPortal } from "react-dom";
import { toast } from "sonner";

export type TileMeta = {
    x: number;
    y: number;
    zoom: number;
    displayName?: string;
    city?: string;
    region?: string;
    countryName?: string;
    countryCode?: string;
    countryFlagEmoji?: string;
    lat?: number;
    lng?: number;
    painted: boolean;
    paintedBy?: { username: string; userId: string };
};

type ShareResult = { shareUrl: string; imageBlob?: Blob | null };

type Props = {
    open: boolean;
    onClose: () => void;
    tile: TileMeta | null;
    onPrimary: (tile: TileMeta) => void;
    // now returns share Url and optional image blob snapshot
    onShare: (tile: TileMeta) => Promise<ShareResult>;
    canCreate: boolean;
    disabledReason?: string;
    className?: string;
};

export function SelectionModal({
    open,
    onClose,
    tile,
    onPrimary,
    onShare,
    canCreate,
    disabledReason = "You're out of tokens — regenerates soon",
    className,
}: Props) {
    const { resolvedTheme } = useTheme();

    React.useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") onClose();
        };
        if (open) window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [open, onClose]);

    // Colors (unchanged)
    const safeHsl = (h: number, s = 62, l = 45) => `hsl(${h} ${s}% ${l}%)`;
    const lightnessToTextColor = (l: number) => (l > 60 ? "#111827" : "#ffffff");


    /**
     * Memoized color generation:
     * - hue1 => username/id accent + avatar bg
     * - hue2 => location chip (text + background)
     *
     * Both hues are chosen randomly but tuned by resolvedTheme so contrast is okay in light & dark modes.
     */
    const {
        accentColor,
        avatarBg,
        avatarText,
        locationTextColor,
        locationBgColor,
    } = React.useMemo(() => {
        const randHue = () => Math.floor(Math.random() * 360);
        const hue1 = randHue();
        const hue2 = randHue();
        const isDark = resolvedTheme === "dark";

        const accentLight = isDark ? 74 : 34;
        const accent = safeHsl(hue1, 66, accentLight);

        const avatarLight = isDark ? 48 : 42;
        const avatar = safeHsl(hue1, 60, avatarLight);
        const avatarTextColor = lightnessToTextColor(avatarLight);

        const locTextLight = isDark ? 86 : 28;
        const locBgLight = isDark ? 22 : 96;
        const locText = safeHsl(hue2, 68, locTextLight);
        const locBg = safeHsl(hue2, 20, locBgLight);

        return {
            accentColor: accent,
            avatarBg: avatar,
            avatarText: avatarTextColor,
            locationTextColor: locText,
            locationBgColor: locBg,
        };
    }, [open, tile?.paintedBy?.username, tile?.paintedBy?.userId, resolvedTheme]);

    const getInitials = (name?: string) => {
        if (!name) return "?";
        const parts = name.trim().split(/\s+/).slice(0, 2);
        return parts.map((p) => p[0]?.toUpperCase() ?? "").join("");
    };

    // SHARE DIALOG state
    const [shareOpen, setShareOpen] = React.useState(false);
    const [shareUrl, setShareUrl] = React.useState<string>("");
    const [imageBlob, setImageBlob] = React.useState<Blob | null>(null);
    const [imagePreviewUrl, setImagePreviewUrl] = React.useState<string | null>(null);
    const [shareLoading, setShareLoading] = React.useState(false);

    React.useEffect(() => {
        // cleanup preview objectUrl when dialog closes or blob changes
        return () => {
            if (imagePreviewUrl) {
                URL.revokeObjectURL(imagePreviewUrl);
            }
        };
    }, [imagePreviewUrl]);


    // Handler: when user clicks the Share action in the main selection modal
    const handleOpenShare = async () => {
        if (!tile) return;
        setShareOpen(true);
        setShareLoading(true);
        setShareUrl("");
        setImageBlob(null);
        setImagePreviewUrl(null);

        try {
            const res = await onShare(tile);
            setShareUrl(res.shareUrl);
            if (res.imageBlob) {
                setImageBlob(res.imageBlob);
                try {
                    const obj = URL.createObjectURL(res.imageBlob);
                    console.log("preview URL", obj);
                    setImagePreviewUrl(obj);
                } catch (e) {
                    // fallback: no preview available
                    console.warn("Couldn't create preview URL", e);
                }
            }
        } catch (err) {
            console.error("onShare failed", err);
            toast.error("Couldn't prepare share info");
        } finally {
            setShareLoading(false);
        }
    };

    const handleCloseShare = () => {
        setShareOpen(false);
        // we keep preview until the effect cleans it up
    };

    const handleCopyLink = async () => {
        if (!shareUrl) return;
        try {
            await navigator.clipboard.writeText(shareUrl);
            toast.success("Link copied");
        } catch (err) {
            console.error("copy link failed", err);
            toast.error("Couldn't copy link");
        }
    };

    const handleCopyImage = async () => {
        if (!imageBlob) {
            toast.error("No image to copy");
            return;
        }
        // Clipboard image copy (modern browsers)
        try {
            // @ts-ignore - ClipboardItem may not be in lib.dom types depending on tsconfig
            const item = new ClipboardItem({ [imageBlob.type || "image/png"]: imageBlob });
            // navigator.clipboard.write expects an array of ClipboardItem
            await (navigator.clipboard as any).write([item]);
            toast.success("Image copied to clipboard");
        } catch (err) {
            console.error("copy image failed", err);
            toast.error("Couldn't copy image");
        }
    };

    const handleDownloadImage = () => {
        if (!imageBlob) {
            toast.error("No image to download");
            return;
        }
        try {
            const url = URL.createObjectURL(imageBlob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `genplace-map-${tile?.x ?? "view"}.png`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            // revoke after short delay to ensure download has started
            setTimeout(() => URL.revokeObjectURL(url), 1500);
            toast.success("Download started");
        } catch (err) {
            console.error("download failed", err);
            toast.error("Couldn't download image");
        }
    };

    // Early return (hooks already declared)
    if (!open || !tile) return null;

    // Prefer a short displayName (set by reverseGeocode). Fallbacks.
    const placeName =
        (tile.displayName && tile.displayName.trim()) ||
        (tile.city && tile.city.trim()) ||
        (tile.region && tile.region.trim()) ||
        (tile.countryName && tile.countryName.trim()) ||
        null;

    const placeLabel = placeName ?? "Unknown location";
    const flagOrCode = tile.countryFlagEmoji ?? tile.countryCode ?? "";
    const locationAria = tile.displayName ? `${tile.displayName}${flagOrCode ? ` ${flagOrCode}` : ""}` : placeLabel;

    const coordLabel = tile.lat != null && tile.lng != null ? `${tile.lat.toFixed(5)},${tile.lng.toFixed(5)}` : "—";

    // TEMP stub: keep for visual demo only (remove in prod)
    tile.painted = true;
    tile.paintedBy = tile.paintedBy ?? { username: "alice", userId: "1234" };

    // Share dialog markup (portal)
    const ShareDialog = shareOpen
        ? createPortal(
            <div
                role="dialog"
                aria-modal="true"
                aria-label="Share GenPlace"
                className="fixed inset-0 z-[1200] grid place-items-center p-4"
            >
                {/* Backdrop */}
                <div
                    className="absolute inset-0 bg-black/40 backdrop-blur-sm"
                    onClick={handleCloseShare}
                    aria-hidden
                />
                <div
                    className={cn(
                        "relative w-[min(96vw,720px)] rounded-2xl bg-white dark:bg-slate-900 text-black dark:text-white",
                        "shadow-2xl border border-black/10 dark:border-white/10 p-5"
                    )}
                >
                    {/* header */}
                    <div className="flex items-center justify-between gap-4">
                        <h3 className="text-lg font-semibold">Share GenPlace</h3>
                        <button
                            aria-label="Close share"
                            onClick={handleCloseShare}
                            className="h-8 w-8 grid place-items-center rounded-full hover:bg-black/5 dark:hover:bg-white/5 transition"
                        >
                            <X className="h-4 w-4" />
                        </button>
                    </div>

                    <div className="mt-4 space-y-4">
                        {/* Share URL input */}
                        <div>
                            <label className="text-sm font-semibold block mb-2">Link</label>
                            <div className="flex gap-2">
                                <input
                                    readOnly
                                    aria-readonly
                                    value={shareLoading ? "Preparing..." : shareUrl}
                                    placeholder="Share link"
                                    className="flex-1 rounded-md px-3 py-2 border border-black/10 dark:border-white/10 bg-gray-50 dark:bg-slate-800 text-sm"
                                />
                                <button
                                    onClick={handleCopyLink}
                                    aria-label="Copy share link"
                                    className="inline-flex items-center gap-2 px-3 rounded-md bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 border border-black/10 dark:border-white/10"
                                >
                                    <Copy className="w-4 h-4" />
                                    <span className="text-sm">Copy</span>
                                </button>
                            </div>
                        </div>

                        {/* Map image preview + actions */}
                        <div>
                            <div className="flex items-center gap-2 mb-2">
                                <ImageIcon className="w-4 h-4" />
                                <h4 className="text-sm font-semibold">Map</h4>
                            </div>

                            <div className="rounded-md overflow-hidden border border-black/10 dark:border-white/10 bg-gray-50 dark:bg-slate-800">
                                {imagePreviewUrl ? (
                                    <img
                                        src={imagePreviewUrl}
                                        alt="Map preview"
                                        className="w-full max-h-[320px] object-cover"
                                    />
                                ) : (
                                    <div className="w-full h-44 grid place-items-center text-sm text-slate-500">
                                        {shareLoading ? "Preparing preview…" : "No preview available"}
                                    </div>
                                )}
                            </div>

                            <div className="mt-3 flex gap-2">
                                <button
                                    onClick={handleCopyImage}
                                    disabled={!imageBlob}
                                    className={cn(
                                        "inline-flex items-center gap-2 rounded-md px-4 py-2",
                                        imageBlob
                                            ? "bg-[hsl(var(--primary))] text-white hover:brightness-105"
                                            : "opacity-60 cursor-not-allowed bg-gray-100 dark:bg-gray-800 text-gray-500"
                                    )}
                                >
                                    <Copy className="w-4 h-4" />
                                    <span className="text-sm">Copy image</span>
                                </button>

                                <button
                                    onClick={handleDownloadImage}
                                    disabled={!imageBlob}
                                    className={cn(
                                        "inline-flex items-center gap-2 rounded-md px-4 py-2 border",
                                        imageBlob
                                            ? "border-black/10 dark:border-white/10 hover:bg-black/5"
                                            : "opacity-60 cursor-not-allowed border-gray-200 dark:border-gray-700 text-gray-500"
                                    )}
                                >
                                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 3v10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /><path d="M8 11l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /><path d="M21 21H3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                                    <span className="text-sm">Download</span>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>,
            document.body
        )
        : null;

    return (
        <>
            <div
                role="dialog"
                aria-label="Selected tile details"
                className={cn(
                    "fixed left-1/2 -translate-x-1/2 z-[1100]",
                    "w-[min(92vw,600px)]",
                    "bottom-[max(1rem,env(safe-area-inset-bottom))]",
                    "rounded-3xl bg-white text-black shadow-[0_12px_40px_rgba(0,0,0,.35)]",
                    "border border-black/10",
                    "dark:bg-slate-900 dark:text-white dark:border-white/10 dark:shadow-[0_12px_40px_rgba(0,0,0,.6)]",
                    "px-5 py-4 md:px-6 md:py-5",
                    "motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-2",
                    className
                )}
            >
                {/* Header */}
                <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                        <div className="grid place-items-center rounded-full bg-blue-100 text-blue-600 h-9 w-9 dark:bg-blue-900/40 dark:text-blue-300">
                            <MapPin className="h-4.5 w-4.5" />
                        </div>

                        <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2 text-[16px] md:text-xl font-medium leading-tight">
                                <span className="font-mono text-slate-700 dark:text-slate-300">{coordLabel}</span>
                                <span className="opacity-40">•</span>

                                <span
                                    role="note"
                                    aria-label={`Location: ${locationAria}`}
                                    className="truncate inline-block text-xs md:text-sm font-semibold"
                                    style={{
                                        background: locationBgColor,
                                        color: locationTextColor,
                                        padding: "4px 8px",
                                        borderRadius: 8,
                                        maxWidth: "48ch",
                                    }}
                                >
                                    <span className="align-middle truncate">{placeLabel}</span>
                                    {flagOrCode ? <span className="ml-2 align-middle">{flagOrCode}</span> : null}
                                </span>
                            </div>

                            <div className="mt-1.5 text-sm md:text-base text-slate-600 dark:text-slate-400">
                                {tile.painted && tile.paintedBy ? (
                                    <div className="flex items-center gap-2">
                                        <span className="text-slate-600 dark:text-slate-400">Created by</span>

                                        <div className="flex items-center gap-2">
                                            <div
                                                className="h-6 w-6 rounded-full grid place-items-center text-xs font-semibold flex-shrink-0"
                                                style={{ background: avatarBg, color: avatarText }}
                                                aria-hidden
                                            >
                                                {getInitials(tile.paintedBy.username)}
                                            </div>

                                            <span className="font-medium truncate max-w-[10rem]" style={{ color: accentColor }}>
                                                @{tile.paintedBy.username}
                                            </span>

                                            <span className="opacity-85 font-mono text-xs" style={{ color: accentColor }}>
                                                #{tile.paintedBy.userId}
                                            </span>
                                        </div>
                                    </div>
                                ) : (
                                    <>Empty</>
                                )}
                            </div>
                        </div>
                    </div>

                    <button
                        aria-label="Close selection"
                        onClick={onClose}
                        className="h-8 w-8 grid place-items-center rounded-full text-black/70 hover:text-black hover:bg-black/5 active:bg-black/10 transition-colors hover:scale-[1.05] active:scale-95 hover:cursor-pointer dark:text-white/70 dark:hover:text-white dark:hover:bg-white/5"
                    >
                        <X className="h-4 w-4" />
                    </button>
                </div>

                {/* Actions */}
                <div className="mt-4 flex flex-wrap items-center gap-2.5">
                    <button
                        aria-label={`Create new image for tile ${tile.x},${tile.y}`}
                        title={canCreate ? "Create an image for this tile" : disabledReason}
                        onClick={canCreate ? () => onPrimary(tile) : undefined}
                        disabled={!canCreate}
                        className={cn(
                            "inline-flex items-center gap-2 rounded-full px-5 h-11",
                            "bg-[hsl(var(--primary))] text-white",
                            "shadow-[0_6px_20px_rgba(59,130,246,.35)]",
                            "transition-colors motion-safe:active:scale-[0.99]",
                            "hover:brightness-105",
                            "hover:cursor-pointer",
                            !canCreate && "opacity-60 cursor-not-allowed hover:brightness-100"
                        )}
                    >
                        <Wand2 className="h-4.5 w-4.5" />
                        <span className="text-[15px] font-semibold">Create</span>
                    </button>

                    <button
                        aria-label={`Share link to tile ${tile.x},${tile.y}`}
                        onClick={handleOpenShare}
                        className={cn(
                            "inline-flex items-center gap-2 rounded-full px-5 h-11",
                            "bg-gray-100 text-gray-900 border border-black/10",
                            "hover:bg-gray-200 active:bg-gray-200/90 transition-colors",
                            "hover:cursor-pointer",
                            "dark:bg-gray-800 dark:text-gray-100 dark:border-white/10 dark:hover:bg-gray-700/90"
                        )}
                    >
                        <Share2 className="h-4.5 w-4.5" />
                        <span className="text-[15px] font-medium">Share</span>
                    </button>
                </div>
            </div>

            {/* render share dialog portal if needed */}
            {ShareDialog}
        </>
    );
}
