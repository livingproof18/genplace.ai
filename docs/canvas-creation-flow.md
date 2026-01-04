---

# Canvas Creation Flow (MVP)

## 0) Primary action button (bottom-center)

**Label pattern**

* **Idle (full):** `Create 5/5`
* **Partial:** `Create 3/5`
* **Regen in progress:** `Create 1/5 (1:20)`
* **Empty:** `Create 0/5 (2:14)`

**Behavior**

* Always visible (unless Selection Modal is open).
* Click opens **Prompt Drawer**.
* If `tokensCurrent === 0`, button is **disabled** but still shows the timer; hover/tooltip explains cooldown.
* If user is **not logged in**, clicking opens **Auth** instead (or shows “Login to create”).

**Design**

* Big, glowing primary pill (you already have this), with small **mono** subtext for the `x/y (mm:ss)` part.
* Icon: `Wand2` or `Sparkles`.

---

## 1) Entry paths

Support both flows (same drawer; preset point is optional):

- **point-first** (your current selection flow)
  User clicks a location at valid zoom → **Checkpoint + Selection Modal** → presses **Create** → opens drawer **with point preset** (`selectedpoint = {x,y}`).

- **Idea-first** (no preset)
  User presses **Create** directly → opens drawer with **no point preset**. After generation, user can **Pick point** during placement step.

> MVP: implement both; if a point is preselected, lock the size point snapping to that zoom (or just remember the coords).

---

## 2) Prompt Drawer (right sheet / modal)

**Layout**

- **Header row:**

  - Left: “Create” title
  - Right: token meter: `Tokens 3/5 • Next +1 in 1:20` (mono for numbers)

- **Size selector row (chips):** `128 • 256 • 512`

  - Each chip shows **token cost** beneath or as a small sublabel (e.g., `256 (1 token)`; `512 (2 tokens)`)
  - MVP: cost = 1 token for all sizes (simplest). If you want differentiation, define constants; UI already supports either.

- **Prompt textarea:** 3–5 rows, placeholder:

  > “A tiny dragon curled on a tea cup, cozy morning light”

- **Tips link:** `Need inspiration?` → small popover with 6 examples; clicking replaces textarea content.
- **Generate controls:**

  - Primary button: **Generate** (icon Wand2)
  - Secondary: **Cancel** (dismiss drawer)
  - Optional: `Safety` note if you want (e.g., “Keep it friendly and safe.”)

**States**

1. **Idle** – fields enabled.
2. **Generating** – disable inputs; show progress **skeleton** and a small **indeterminate bar** with playful tips:

   - “Dreaming up your dragon…”
   - “Adding cozy light…”

3. **Preview** – show result(s) and actions.
4. **Error / Moderation** – show message + safe prompt examples + “Try again”.

**Variants returned**

- **MVP**: request **2 variants** per prompt (A/B).

  - Grid: two cards side-by-side (stack on mobile).
  - Each card: image, a subtle “Regenerate” link for that slot (1 re-roll per slot for MVP).
  - Selecting a card highlights it with a blue ring.

**Microcopy**

- Generate button: **Generate**
- Regenerate link: **Regenerate**
- Error (moderation): “That prompt might be unsafe. Try rephrasing or choose an idea from Tips.”

**Accessibility**

- Focus first on the prompt when opening.
- `Esc` closes the drawer.
- `Enter` (with command/ctrl) submits the prompt; normal Enter creates newline.

---

## 3) Placement step

After a variant is selected:

- If you came **point-first** and still at valid zoom, show the **Place** CTA (enabled).
- If no point preset:

  - Show a banner: “Pick a point on the map to place this image.”
  - Drawer stays open; HUD shows a hint; clicks will **snap** to the nearest point and show a **ghost preview** at that point.

- **Place button** (sticky at bottom of drawer):

  - **Label:** `Place (1 token)` (or `Place (2 tokens)` if 512 costs 2)
  - Disabled if `tokensCurrent === 0` → show “Out of tokens — regenerates in 1:20”.

- On **Place**:

  - Hit `/place` with `{x,y,size,imageUrl|id}`.
  - Deduct tokens (on server) and return the updated token state.
  - Drawer closes, Selection Modal can show brief success (or show the image live; your canvas already updates via WS).
  - Primary button reverts to **Create x/y (mm:ss)** state.

**What consumes tokens?**

- **MVP recommendation:** **Token is consumed on Place**, not on Generate.

  - Pros: users can explore options without feeling punished.
  - Cons: generation has real cost.
  - Mitigations: throttle `Generate` to **1 request per 10s** and **2 variants max**, per user; add **hard cap** like 10 generations/hour/user on the back end for MVP.

- If you must gate generation: use a separate **gen credit** with small free pool; refund if not placed within 2 minutes. This is more complex—skip for MVP.

---

## 4) Button copy rules (bottom-center)

**Idle rules**

- Format: `Create ${tokens}/${maxTokens}${cooldownSuffix}`
- `cooldownSuffix = tokens < max ? \` (${mm:ss})` : ""`
- Example: `Create 5/5`, `Create 1/5 (1:20)`

**Hover tooltip**

- If tokens > 0: “Type a prompt → generate → place it on the map.”
- If tokens = 0: “Out of tokens — regenerates in ${mm:ss}.”

**Disabled state**

- Keep the button visible, disabled (opacity 60%), cursor not-allowed.

---

## 5) Component state machine (text)

```
[Create Button]
  ├─ click → [Prompt Drawer: Idle]
  │             ├─ Generate → [Generating]
  │             │               ├─ ok → [Preview(2 variants)]
  │             │               │        ├─ select A/B → [Selected]
  │             │               │        ├─ regenerate slot → [GeneratingSlot] → [Preview]
  │             │               │        └─ place → [Placing] → [Done] → close
  │             │               └─ error/moderation → [Error] (stay in drawer)
  │             └─ Cancel → close
  └─ (disabled) tooltip cooldown
```

**point-first path**

```
[Map click @ valid zoom] → [Checkpoint + Selection Modal] → Create → [Prompt Drawer]
  (point preset carries into Place call)
```

---

## 6) Data contracts

```ts
// Drawer local state
type GenerateRequest = {
  prompt: string;
  size: 128 | 256 | 512;
};

type GenerateResponse = {
  requestId: string;
  variants: Array<{ id: string; url: string }>; // 1-2 items
  moderation?: { ok: boolean; reason?: string };
};

type PlaceRequest = {
  variantId: string; // chosen image
  x: number;
  y: number;
  size: 128 | 256 | 512;
};

type PlaceResponse = {
  placed: { x: number; y: number; url: string; z: number };
  tokens: { current: number; max: number; nextRegenAt: number }; // epoch ms
};
```

**Token math (client)**

- `cooldownRemaining = Math.max(0, nextRegenAt - now)`
- `mm:ss` from that value; when it hits 0, **+1 token** (capped at max), recalc nextRegenAt.

---

## 7) Loading & feedback details

- **Generating:**

  - Show image frame skeletons (2 placeholders).
  - Small progress bar (indeterminate).
  - Tips rotate every ~2s (string array).

- **Placing:**

  - Disable Place button; label → “Placing…”
  - On success: `toast.success("Placed!")` (top-right); close drawer.

- **Errors:**

  - `toast.error("Something went wrong. Try again.")`
  - Moderation: inline message under prompt:
    “This prompt may be unsafe. Try removing violent/NSFW terms.” + **Try these** chips.

---

## 8) Microcopy (exact strings)

- **Create button (idle):** `Create 5/5`
- **Create button (cooldown):** `Create 1/5 (1:20)`
- **Drawer title:** `Create`
- **Size chips:** `128`, `256`, `512` (optional sublabel: `1 token`)
- **Prompt placeholder:** `A tiny dragon curled on a tea cup, cozy morning light`
- **Generate:** `Generate`
- **Regenerate:** `Regenerate`
- **Place:** `Place (1 token)`
- **Out of tokens (disabled):** `Out of tokens — regenerates in 1:20`
- **Toast (placed):** `Placed!`
- **Toast (copied):** `Link copied`

---

## 9) Accessibility

- Drawer uses `role="dialog"` with labelled title.
- Focus first on the prompt; trap focus in the drawer.
- `Esc` closes.
- Buttons have ARIA labels with point coordinates when relevant.
- Respect `prefers-reduced-motion` (reduce big transitions; keep subtle fades).

---

## 11) Quick UI notes for devs

- **Size selector**: use pill chips; selected = primary outline or filled.
- **Images**: fixed aspect (square), `object-cover`, `rounded-xl`, `overflow-hidden`.
- **Selected variant**: `ring-2 ring-[hsl(var(--primary))] ring-offset-2 ring-offset-white`.
- **Place button** should be **sticky** at the drawer bottom on mobile (safe-area aware).
- **Ghost preview** on map when hovering a point (nice-to-have).

---

## 12) Edge cases

- **Zoom gate**: if user zooms out while drawer is open, keep drawer open, but disable “Place” until zoomed in (show inline warning).
- **Token hit at confirmation**: if tokens become 0 between Generate and Place (race), show inline message and disable Place; keep image so they can wait.
- **Navigation away**: warn if user tries to close drawer with a generated image (optional).

---

### TL;DR

- Bottom button always tells the **truth** about tokens: `Create x/y (mm:ss)`.
- Drawer: **Size → Prompt → Generate → Pick variant → Place**.
- **Tokens consumed on Place** (MVP), generation rate-limited.
- Works **point-first** and **idea-first**.
- Crisp, cinematic UI with clear states and minimal confusion.
