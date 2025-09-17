// src/app/page.tsx
import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { MosaicPreview } from "@/components/mosaic-preview";
import { HowItWorks } from "@/components/how-it-works";
import { LiveTicker } from "@/components/live-ticker";
import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <div className="font-sans relative">
      <SiteHeader />

      {/* HERO */}
      <section className="relative overflow-hidden">
        {/* Cinematic backdrop */}
        <div className="absolute inset-0 bg-gradient-to-b from-primary/10 via-background/40 to-background" />
        <div className="absolute inset-0 bg-noise opacity-70" />
        <div className="vignette absolute inset-0" />

        <div className="relative mx-auto max-w-7xl px-4 py-16 md:py-24 grid md:grid-cols-2 gap-10 items-center">
          {/* Left copy */}
          <div className="space-y-6">
            <h1 className="text-4xl md:text-5xl font-semibold tracking-tight">
              GenPlace: the place where <span className="text-primary">prompts</span> come alive
            </h1>
            <p className="text-base md:text-lg text-muted-foreground max-w-prose">
              Type a prompt, generate AI art, and place it onto a shared world.
              Watch the canvas evolve in real time.
            </p>
            <div className="pt-2">
              <Button asChild size="lg" className="rounded-2xl btn-glow">
                <Link href="/map">Go to Canvas</Link>
              </Button>
            </div>
          </div>

          {/* Right: animated mosaic */}
          <div className="flex justify-center md:justify-end">
            <MosaicPreview cols={6} rows={4} size={88} showCaption />
          </div>
        </div>
      </section>

      {/* Live activity (keep, but soften outlines) */}
      <section className="py-8 md:py-12">
        <div className="mx-auto max-w-7xl px-4">
          <LiveTicker />
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="py-8 md:py-14">
        <HowItWorks />
      </section>

      {/* Why GenPlace */}
      <section className="mx-auto max-w-7xl px-4 pb-16">
        <div className="rounded-2xl glass ring-gradient p-6 md:p-8">
          <h2 className="text-2xl md:text-3xl font-semibold tracking-tight mb-4">Why GenPlace</h2>
          <ul className="grid md:grid-cols-3 gap-3 text-sm text-muted-foreground">
            <li className="rounded-xl glass p-4">
              <span className="font-medium text-foreground">Social</span> — build together on one living canvas.
            </li>
            <li className="rounded-xl glass p-4">
              <span className="font-medium text-foreground">Generative</span> — anyone can create with a single prompt.
            </li>
            <li className="rounded-xl glass p-4">
              <span className="font-medium text-foreground">Gamey</span> — cooldowns, levels, and friendly rivalry.
            </li>
          </ul>
        </div>
      </section>

      {/* Footer (no harsh border) */}
      <footer className="border-t border-white/10">
        <div className="mx-auto max-w-7xl px-4 py-6 text-sm text-muted-foreground flex items-center justify-between">
          <span>© {new Date().getFullYear()} GenPlace</span>
          <nav className="flex gap-4">
            <Link href="/terms" className="hover:text-foreground">Terms</Link>
            <Link href="/privacy" className="hover:text-foreground">Privacy</Link>
            <a href="https://x.com/placeholder" target="_blank" rel="noreferrer" className="hover:text-foreground">X/Twitter</a>
            <a href="https://discord.gg/placeholder" target="_blank" rel="noreferrer" className="hover:text-foreground">Discord</a>
          </nav>
        </div>
      </footer>
    </div>
  );
}
