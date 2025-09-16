// src/components/site-header.tsx
"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";

export function SiteHeader() {
    return (
        <header className="sticky top-0 z-40 w-full border-b bg-background/80 backdrop-blur">
            <div className="mx-auto max-w-7xl px-4 py-3 flex items-center justify-between">
                <Link href="/" className="flex items-center gap-2">
                    <div className="h-6 w-6 rounded-md bg-gradient-to-br from-blue-400 to-blue-600" />
                    <span className="font-semibold tracking-tight">GenPlace</span>
                </Link>

                <nav className="hidden md:flex items-center gap-6 text-sm text-muted-foreground">
                    <Link href="/map" className="hover:text-foreground transition">Live map</Link>
                    <Link href="/gallery" className="hover:text-foreground transition">Gallery</Link>
                    <a
                        href="https://discord.gg/placeholder"
                        target="_blank"
                        rel="noreferrer"
                        className="hover:text-foreground transition"
                    >
                        Discord
                    </a>
                </nav>

                <div className="flex items-center gap-2">
                    <ThemeToggle />
                    <Button asChild className="rounded-2xl shadow-glow">
                        <Link href="/map">Go to Canvas</Link>
                    </Button>
                </div>
            </div>
        </header>
    );
}
