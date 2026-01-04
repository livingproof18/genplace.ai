GenPlace uses world-anchored raster images whose size is defined at a fixed reference zoom (≈11).
This ensures that image sizes feel intuitive at interaction zoom, remain stable across placements, and scale naturally with map zoom.
The reference zoom is a contract — changing it would resize all existing artwork.

---

Got it — we’ll stick with Option A (WPlace‑style world pixels). That’s already the logic in maplibre-world.tsx. With CANVAS_ZOOM = MIN_INTERACT_ZOOM, it’s visible and consistent at the zoom you actually interact with, so no extra code changes are required to “make it work.” We can do cleanup/documentation if you want, but the behavior is now aligned with Option A.

Below is a clean, kid‑simple explanation of how it works and what the terms mean.

The simplest mental model (child version)

Imagine the whole world map is covered with a huge invisible grid of tiny squares (pixels).
That grid has a fixed resolution that never changes.

When you place an image:

You say “this image is 128×128 squares on the grid.”
That size is locked to the grid, not to your screen.
If you zoom in:

The squares get bigger on your screen.
If you zoom out:
The squares get smaller on your screen.
So the image feels like a real object on the map.

That’s world‑anchored.

What “lock the reference zoom to your interaction zoom” means

“256px” is just a number.
It only means something relative to a zoom level.

If you say:

CANVAS_ZOOM = 11
You are saying:

“At zoom 11, an image with size 256 should appear as ~256 screen pixels.”

Then:

At zoom 12: it looks ~512 screen pixels
At zoom 10: it looks ~128 screen pixels
So the world size stays the same, but your screen size changes because you zoomed.

That’s exactly what you want.

Why CANVAS_ZOOM affects visibility

Because screen size changes with zoom.

Formula:

screenPx = pixelSize \* 2^(currentZoom - CANVAS_ZOOM)
Example:

pixelSize = 256
CANVAS_ZOOM = 22
currentZoom = 11
screenPx = 256 \* 2^(11-22)
= 256 / 2048
= 0.125px
So it’s invisible.

That’s why we align CANVAS_ZOOM to your actual usage zoom (≈11).

Mercator distortion (latitude effect)

The map projection stretches things as you go toward the poles.
So a “world pixel” near Canada covers fewer real meters than a “world pixel” near the equator.

Result:

Your images are the same size in map pixels
But they represent different real‑world meters depending on latitude
That’s expected in WPlace‑style systems.

Does “128 size” mean 128 real pixels on the map?

Yes — but at the reference zoom only.

With CANVAS_ZOOM = 11:

At zoom 11: 128 means ~128 screen px
At zoom 12: looks like ~256 screen px
At zoom 10: looks like ~64 screen px
The world size stays fixed, the screen size changes with zoom.

So what exactly is our current logic doing?

In maplibre-world.tsx:

We convert the placement lat/lng into “world pixel space”
We create a square image bounds of pixelSize at CANVAS_ZOOM
MapLibre scales it automatically with zoom
So:

✅ Same world size always
✅ Not affected by placement zoom
✅ Looks bigger/smaller as you zoom in/out
✅ Matches WPlace feel

---

Great question — this is _the_ core conceptual difference, and once you see it, everything you’ve been debugging snaps into place.

I’ll explain this in **plain language first**, then with **math**, then compare **WPlace vs GenPlace**, and finally give a **clear recommendation**.

---

# 1️⃣ What is a “reference zoom”?

A **reference zoom** answers one question:

> _At what zoom level does “256px” actually mean 256 pixels on screen?_

Everything else flows from that.

Because in slippy maps:

- Every zoom step doubles or halves screen pixels
- So **pixel sizes are meaningless unless tied to a zoom**

---

## The universal formula (this never changes)

```
screenPixels = worldPixels × 2^(currentZoom − referenceZoom)
```

This is true for **MapLibre**, **Mapbox**, **WPlace**, everything.

---

# 2️⃣ What is a “high reference zoom”?

A **high reference zoom** means:

> “We define world size at a zoom level so high that the grid is effectively ‘absolute’.”

Typically:

- `referenceZoom = 22` (or even 23–24 internally)
- This is near the **maximum resolution of the Web Mercator world**

At zoom 22:

- The world is ~2 billion pixels wide
- One “world pixel” is extremely tiny geographically
- That grid is treated as the **canonical coordinate system**

### Key idea

At high zoom:

> World pixels ≈ _absolute units_

So everything becomes:

- Stable
- Zoom-independent
- Future-proof

---

# 3️⃣ What does WPlace do?

### WPlace’s internal logic (simplified)

1. **Fix the reference zoom very high**

   ```ts
   CANVAS_ZOOM = 22;
   ```

2. **Define sizes in that grid**

   ```ts
   worldSize = (512 * 2) ^ 22;
   ```

3. **When users choose a size**, WPlace **scales the size**, not the zoom.

Instead of changing `CANVAS_ZOOM`, they do:

```
worldPixelSize = desiredScreenSize × 2^(referenceZoom − interactionZoom)
```

So if:

- User is interacting at zoom 11
- Wants a “256px” image
- Reference zoom = 22

They compute:

```
256 × 2^(22 − 11) = 256 × 2048 ≈ 524,288 world pixels
```

That giant number is then:

- Converted to lat/lng bounds
- Anchored forever

---

## Why this works

Because:

- The **reference zoom never changes**
- “256px” is always converted into the correct world size
- Old art never changes size even if UI rules change

This is how WPlace can:

- Claim trillions of pixels
- Change UI zoom thresholds freely
- Never resize historical placements

---

# 4️⃣ What GenPlace is doing right now

You flipped the approach.

Instead of:

> “Keep reference zoom high, scale size”

You chose:

> “Keep size literal, lower the reference zoom”

```ts
CANVAS_ZOOM = MIN_INTERACT_ZOOM; // ~11
```

This means:

- At zoom 11 → 256px ≈ 256 screen pixels
- At zoom 12 → ~512 screen pixels
- At zoom 10 → ~128 screen pixels

### Conceptually:

You moved the **origin** of meaning closer to the user.

That’s why everything suddenly became visible.

---

# 5️⃣ Side-by-side comparison

| Concept        | WPlace              | GenPlace (current)     |
| -------------- | ------------------- | ---------------------- |
| Reference zoom | Very high (≈22)     | Interaction zoom (≈11) |
| World grid     | Absolute, invisible | Relative to user       |
| Size meaning   | Computed (scaled)   | Literal                |
| Math location  | Size conversion     | Zoom definition        |
| UX simplicity  | Medium              | **Very high**          |
| Future-proof   | **Very high**       | Medium                 |
| MVP speed      | Slower              | **Faster**             |

Neither is “wrong” — they optimize for different goals.

---

# 6️⃣ Why WPlace _needs_ the high reference zoom

WPlace:

- Has millions of placements
- Needs long-term stability
- May change interaction zoom rules over time
- Needs absolute determinism

So they say:

> “The grid is sacred. UI adapts to the grid.”

---

# 7️⃣ Why GenPlace is fine doing what it’s doing (for now)

GenPlace:

- Is early-stage
- Has human-scale sizes (128 / 256 / 512)
- Cares more about **feel** than mathematical purity
- Is unlikely to change interaction zoom soon

So your approach says:

> “The user’s working zoom is the truth.”

That’s **excellent product thinking** for an MVP.

---

# 8️⃣ The one real difference that matters long-term

Here’s the _only_ risk in your current approach:

> If you change `CANVAS_ZOOM` later, **all existing art resizes**.

WPlace is immune to that.
GenPlace is not (yet).

That’s why I suggested:

```ts
const CANVAS_ZOOM = 11; // frozen contract
```

Not tied to `MIN_INTERACT_ZOOM`.

---

# 9️⃣ Should you switch to WPlace’s logic now?

### ❌ No — not yet.

Reasons:

- Your current logic is simpler
- It’s easier to reason about
- It matches how users think
- It already works
- Switching adds complexity without user benefit

### ✅ When should you switch?

Only if:

- You want to change interaction zoom rules later
- You want absolute, immutable world scaling
- You start storing millions of placements long-term
- You want multiple map styles / DPI scaling
- You expose programmatic placement APIs

At that point, you’d:

- Keep `CANVAS_ZOOM = 22`
- Add the scaling formula you already wrote
- Migrate once, intentionally

---

# 🔑 Final mental model (remember this)

- **High reference zoom** = “the grid is absolute”
- **Low reference zoom** = “the user’s view defines meaning”
- **WPlace** optimizes for permanence
- **GenPlace** optimizes for clarity & speed

What you built is **not a hack**.
It’s a _deliberate design tradeoff_ — and a good one for where GenPlace is today.

If you want, next we can:

- Write a migration-safe abstraction so switching later is painless
- Or document this formally in your internal engineering README
