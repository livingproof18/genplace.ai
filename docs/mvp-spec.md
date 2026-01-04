---
# 🚀 MVP Spec: AI Collaborative Canvas

## 1. Core Concept

A shared online **canvas** (map or abstract grid) where users can **generate images via AI prompts** and place them onto the canvas. Unlike Wplace’s pixel-by-pixel placement, each contribution is a **prompted AI image**.
---

## 2. MVP Features

### 🎨 Image Generation

- **Prompt input box** (text).
- **Size options**:
  - MVP: 256×256 (default).
  - Optional at launch: offer 3 sizes (128, 256, 512), unlock 512×512 as users “level up” or after X contributions.
- **API-based generation** (Stable Diffusion API, OpenAI’s DALL·E, or others).
- **Single model at first** → future: let users choose their preferred model provider.

### 🗺 Canvas & Placement

- A **point-based map** (zoomable/pannable, like Google Maps).
- Users can **claim an empty slot** (one point) → generate → place image.
- Placed images snap into a grid slot (keeps layout orderly).
- Overwriting allowed: new image replaces old one (like Wplace pixel overwrites).

### ⏳ Limits / Game Mechanics

- **Cooldown system**:
  - Example: 1 image per 10 minutes (regen timer).
  - Prevents spam and controls API cost.
- **Tokens**: each image placement costs a “token.” Tokens regenerate over time.
- **Leveling mechanic (basic)**: more placements = more max tokens / bigger image size unlocked.

### 🔍 Viewing / Interaction

- Users can **pan/zoom** the canvas.
- **Click on a point**: shows prompt + author + timestamp.
- **Gallery view**: optional list of latest uploads.

### ✅ Moderation

- **API provider’s built-in moderation** (OpenAI, Stability, etc.) at MVP stage.
- **Simple reporting button** for users to flag images.

---

## 3. Nice-to-Have (Future Iterations)

- **Model choice dropdown** (OpenAI, Stability, Midjourney API if available).
- **Advanced placement**: ability to resize images or place partially overlapping.
- **Style filters** (e.g. anime, pixel art, watercolor).
- **Leaderboards** (top contributors, most-liked images, region activity).
- **Time-lapse playback** (see how the canvas evolved).
- **Community collabs** (groups reserve regions of the map).
- **Geospatial mode**: tie placement to real map coordinates (like Wplace).
- **Social features**: likes, comments, follows.

---

## 4. Infrastructure

### 🔧 Backend

- **Web backend**: handles auth, tokens, API requests to image provider, and writes placements.
- **Database**: store
  - placements (point coords, image URL, prompt, user, timestamp),
  - user state (tokens, cooldown, level).
- **Storage/CDN**: generated images saved in object storage (e.g. S3, GCS) and served via CDN.

### ⚡ Frontend

- **Web app** (React/Next.js + map library like Leaflet or Mapbox GL).
- **point-based rendering** for canvas images.
- **WebSocket** for live updates (when new images are placed).

### 🛠 Moderation

- Rely on provider moderation at MVP (cheapest + fastest path).
- Later: add your own NSFW filter or human moderation queue for flagged content.

---

## 5. Monetization (to explore later)

Since **AI image generation costs money per call**, you’ll need to cover costs:

- **Free tier**: 1–2 generations per hour (with cooldown).
- **Premium tier**: subscription or credits → more generations, larger images, faster cooldown.
- **Cosmetics**: special borders, styles, frames for your images.
- **Community features**: groups can reserve regions for a fee.

At MVP → just **free tier with cooldown** is fine. You can subsidize early usage and see traction.

---

## 6. Viral Potential

Why this has strong viral hooks:

- **Novelty**: first shared AI-generated “canvas” (not just pixels).
- **Social sharing**: screenshots of AI-art mosaic → perfect for Twitter/TikTok virality.
- **Competition**: users overwrite others → drama + engagement.
- **Accessibility**: anyone can type a prompt; no art skills required.

---

✅ **MVP Launch Checklist**

1. Core canvas grid (React + Leaflet).
2. Prompt input → call image gen API → save image → place in slot.
3. Cooldown per user (token system).
4. Live updates (WebSockets).
5. Basic moderation (provider API + report button).
6. CDN for serving images fast.

That’s enough to launch a first playable prototype.

---

Do you want me to **sketch a system diagram + data flow** for this MVP (like how a request goes from prompt → API → canvas update)? That would make it easier for dev planning.

—

Great point — the **point size options** will really shape how the canvas feels. Too small and people get frustrated that their images are barely visible; too large and one user can dominate the map. Let’s think this through.

---

## 🎯 Key Considerations

1. **Visibility vs. footprint**
   - Small images let the canvas stay busy and collaborative (lots of contributions per area).
   - Large images feel rewarding (wow factor) but risk crowding out others.
2. **Practical storage/rendering**
   - Image generation is heavier the bigger the size.
   - Square powers of 2 (128, 256, 512, 1024…) are efficient for storage, scaling, tiling.
3. **Map coherence**
   - You don’t want a single image covering half a continent (if map-based).
   - You want sizes that “nest” naturally in a grid, so images align.

---

## 🧮 Suggested Size Ladder (6–7 options)

I’d recommend something like:

- **128×128** → Smallest point (good for “stickers” / micro-art).
- **192×192** (optional non-power of 2) → Slightly larger but still small.
- **256×256** → Solid default (clear but not overwhelming).
- **384×384** → For mid-tier users, noticeable without being too big.
- **512×512** → Feels “large,” strong upgrade.
- **768×768** → Big contribution, requires commitment.
- **1024×1024** → Largest option — rare/unlockable so it feels prestigious.

---

## 🔑 Why this works

- **Starts small (128)** → users can quickly place “stickers” everywhere.
- **Middle range (256–512)** → keeps most art balanced and map busy.
- **Upper range (768–1024)** → only a few of these exist per area; they dominate, but you can make them harder to unlock (leveling, premium).

This gives you **6–7 rungs** with logical progression. You can also **gate by cooldown or tokens** (larger images cost more tokens or longer cooldowns), which naturally balances the ecosystem.

---

## 🚦 Practical Recommendation

- MVP: offer **3 sizes** (128, 256, 512).
- Future: expand to full 6–7 options as you test how the community uses space.

---
