// src/app/page.tsx
import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { MosaicPreview } from "@/components/mosaic-preview";
import { HowItWorks } from "@/components/how-it-works";
import { LiveTicker } from "@/components/live-ticker";
import { Button } from "@/components/ui/button";
import { Users, Sparkles, Clock } from "lucide-react";

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

        <div className="relative mx-auto max-w-5xl px-4 py-20 md:py-28 flex flex-col items-start md:items-center">
          {/* Centered copy (mosaic hidden for MVP) */}
          <div className="w-full md:w-[80%] lg:w-[60%] text-left md:text-center space-y-6">
            <h1 className="text-4xl md:text-5xl font-semibold tracking-tight leading-tight">
              GenPlace — where <span className="text-primary">prompts</span> become shared art
            </h1>

            <p className="text-base md:text-lg text-muted-foreground max-w-prose mx-0 md:mx-auto">
              Type a prompt, generate AI art, and place it onto a shared canvas. Collaborate,
              explore, and watch the world evolve one tile at a time.
            </p>

            <div className="pt-2 flex flex-col sm:flex-row sm:justify-center gap-3">
              <Button asChild size="lg" className="rounded-2xl btn-glow">
                <Link href="/map">Go to Canvas</Link>
              </Button>

              <Button
                variant="ghost"
                asChild
                size="lg"
                className="rounded-2xl border border-border/40 px-5"
              >
                <Link href="/about">Learn more</Link>
              </Button>
            </div>

            {/* Small supportive line */}
            <div className="mt-4 text-sm text-muted-foreground md:mx-auto">
              Free for experimentation — tokens limit generation rate for a playful shared experience.
            </div>
          </div>

          {/* Right: animated mosaic — HIDDEN for MVP but kept in DOM */}
          <div className="mt-10 hidden" aria-hidden>
            <MosaicPreview cols={6} rows={4} size={88} showCaption />
          </div>
        </div>
      </section>

      {/* Live activity (hidden for MVP) */}
      <section className="py-8 md:py-12">
        <div className="mx-auto max-w-7xl px-4">
          <div className="hidden" aria-hidden>
            <LiveTicker />
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="py-8 md:py-14">
        <HowItWorks />
      </section>

      {/* Why GenPlace */}
      <section className="mx-auto max-w-7xl px-4 pb-16">
        <div className="rounded-2xl glass ring-gradient p-6 md:p-8">
          <h2 className="text-2xl md:text-3xl font-semibold tracking-tight mb-6 text-foreground">Why GenPlace</h2>

          <ul className="grid md:grid-cols-3 gap-4">
            {/* Card 1 */}
            <li
              className="group flex items-start gap-4 p-4 rounded-2xl bg-card/60 border border-border/40 transition-shadow hover:shadow-glow focus-within:shadow-glow"
              tabIndex={0}
            >
              <div
                className="flex-shrink-0 grid place-items-center h-12 w-12 rounded-xl"
                style={{ background: "color-mix(in srgb, var(--color-primary) 8%, transparent)" }}
                aria-hidden
              >
                <Users className="h-6 w-6 text-primary" />
              </div>
              <div>
                <div className="text-sm font-semibold text-foreground">Social</div>
                <p className="mt-1 text-sm text-muted-foreground">Collaborate on a living canvas — see others' creations and contribute your own.</p>
              </div>
            </li>

            {/* Card 2 */}
            <li
              className="group flex items-start gap-4 p-4 rounded-2xl bg-card/60 border border-border/40 transition-shadow hover:shadow-glow focus-within:shadow-glow"
              tabIndex={0}
            >
              <div
                className="flex-shrink-0 grid place-items-center h-12 w-12 rounded-xl"
                style={{ background: "color-mix(in srgb, var(--color-accent) 8%, transparent)" }}
                aria-hidden
              >
                <Sparkles className="h-6 w-6 text-primary" />
              </div>
              <div>
                <div className="text-sm font-semibold text-foreground">Generative</div>
                <p className="mt-1 text-sm text-muted-foreground">One prompt is all it takes — generate expressive art with configurable size & style.</p>
              </div>
            </li>

            {/* Card 3 */}
            <li
              className="group flex items-start gap-4 p-4 rounded-2xl bg-card/60 border border-border/40 transition-shadow hover:shadow-glow focus-within:shadow-glow"
              tabIndex={0}
            >
              <div
                className="flex-shrink-0 grid place-items-center h-12 w-12 rounded-xl"
                style={{ background: "color-mix(in srgb, var(--color-muted) 10%, transparent)" }}
                aria-hidden
              >
                <Clock className="h-6 w-6 text-primary" />
              </div>
              <div>
                <div className="text-sm font-semibold text-foreground">Persistent</div>
                <p className="mt-1 text-sm text-muted-foreground">Creations persist on the shared map — revisit and remix the community's evolving story.</p>
              </div>
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
