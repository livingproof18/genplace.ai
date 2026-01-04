# 🧠 GenPlace.ai — Project Overview & Technical Vision

## 1. What GenPlace Is (High-Level)

**GenPlace.ai** is a **shared, persistent, collaborative canvas** where users generate **AI images from text prompts** and place them onto a **zoomable map/grid** that everyone sees in real time.

Think of it as:

> **r/Place × WPlace × Generative AI × game mechanics**

But instead of placing pixels manually, users contribute **entire AI-generated images** with a single prompt.

The canvas becomes a **living artwork** — constantly evolving as users collaborate, compete, overwrite, and react to one another’s creations.

---

## 2. The Core Problem We’re Solving

### Problems in existing tools

1. **AI image generators are solitary**

   - You generate an image → download it → it disappears into your personal gallery.
   - No shared context, no persistence, no social meaning.

2. **Collaborative canvases lack creativity leverage**

   - r/Place / WPlace require manual pixel work.
   - Fun, but time-intensive and skill-dependent.

3. **There is no “social surface” for generative AI**

   - AI art has momentum, but nowhere for **collective expression**.

### GenPlace’s answer

GenPlace creates a **shared creative battlefield** where:

- Creativity is **accessible** (one prompt, no skill barrier),
- Contributions are **persistent and visible**,
- The experience is **game-like, paced, and social**.

---

## 3. Product Vision (Non-Negotiables)

GenPlace is designed around these core principles:

### 1. **One Prompt = One Meaningful Contribution**

No drawing tools, no pixel micromanagement.
Typing a prompt should feel powerful.

### 2. **The Canvas Is the Product**

Everything revolves around the shared map:

- The UI is secondary.
- User profiles are secondary.
- The canvas is the star.

### 3. **Real-Time, Shared Reality**

When someone places an image:

- Everyone else sees it immediately.
- The world visibly changes.

### 4. **Constraints Create Fun**

Cooldowns, tokens, overwrites, size limits — these are not restrictions, they are **game mechanics**.

---

## 4. Mental Model: How the System Works

At its simplest:

```
Prompt → AI Image → Image Placement → Real-Time Update
```

But under the hood, GenPlace behaves more like a **multiplayer strategy game** than a typical web app.

### The Canvas

- A Canvas rendered inside a zoomable map (Leaflet / Mapbox style).
- Each Point can contain **exactly one placed image** at a time.

### Images

- Images are free-floating media.
- Each image **occupies space** on the map.
- Space is finite at any zoom level → scarcity creates conflict and collaboration.

---

## 5. User Experience: End-to-End Flow

### A. First-Time User

1. User lands on GenPlace.
2. Clicks **“Go to Canvas”**.
3. Sees a massive shared map filled with AI art.
4. Clicks an **empty point** (or taps “Create”).
5. Prompt drawer opens.
6. Enters a prompt (e.g. _“A cyberpunk fox overlooking a neon city”_).
7. Selects a size (128 / 256 / 512).
8. Generates → previews → places.
9. Their image appears instantly for everyone.

This entire flow is designed to take **<30 seconds**.

---

### B. Returning User Loop (Core Engagement)

1. User opens the map.
2. Sees new images since last visit.
3. Notices a region being “fought over”.
4. Waits for a token to regenerate.
5. Places a counter-image.
6. Leaves.
7. Comes back later to see if it was overwritten.

This loop is intentional.
**GenPlace is built for repeat micro-sessions**, not long single sessions.

---

## 6. Tokens & Cooldowns (Why They Exist)

The token system is not just monetization — it is **core gameplay infrastructure**.

### Why tokens exist

1. **Cost control**

   - AI generation costs real money.

2. **Anti-spam**

   - Prevents flooding.

3. **Pacing**

   - Forces users to wait, return, and plan.

4. **Value signaling**

   - Larger images feel meaningful because they cost more.

### Mental model

Tokens are **energy**, like in a mobile strategy game.

- You don’t spam moves.
- You wait, then strike.

### Key design decision (important for engineers)

> **Tokens are consumed on placement, not generation (MVP).**

This allows:

- Creative exploration without penalty.
- Cleaner UX.
- Better perceived fairness.

Generation itself is still rate-limited server-side.

---

## 7. Overwriting & Competition

One of the most important mechanics:

> **Any image can be overwritten by another image.**

There is no permanent ownership of space.

This creates:

- Territorial behavior.
- Fandom wars.
- Social drama.
- Emergent narratives.

Overwrites are not griefing — they are **the point**.

---

## 8. Real-Time Architecture (Conceptual)

### What “real-time” means here

- The canvas is not refreshed manually.
- The client subscribes to **placement updates**.
- When a placement occurs, all relevant clients update immediately.

### Why this matters

Without real-time:

- The canvas feels fake.
- The sense of shared presence disappears.

Realtime is **existential**, not optional.

---

## 9. Data Model (Conceptual, Not SQL)

At a high level, we track:

- **Users**

  - Tokens, cooldowns, level.

- **Points / Slots**

  - Coordinates, zoom level.

- **Placements**

  - Image URL, prompt, author, timestamp.

- **Generation requests**

  - Moderation state, size, cost.

- **Reports**

  - User-flagged content.

Everything else (likes, comments, history playback) is layered on later.

---

## 10. Moderation Philosophy (MVP)

Moderation is intentionally **minimal at MVP**.

- We rely primarily on **AI provider safety filters**.
- We provide a **report button** for the community.
- We log everything for future tooling.

The goal is:

- Ship fast.
- Stay safe.
- Learn where abuse actually happens before over-engineering.

---

## 11. What GenPlace Is _Not_ (Important)

To avoid misalignment:

- ❌ Not a personal AI art gallery.
- ❌ Not a traditional social network.
- ❌ Not a drawing app.
- ❌ Not a marketplace at MVP.

It is a **shared world** first and foremost.

---

## 12. Why This Is Interesting Technically

For a senior engineer, GenPlace is compelling because it combines:

- Real-time systems.
- Spatial data modeling.
- Rate-limited AI pipelines.
- Multiplayer-style state consistency.
- Cost-aware architecture.
- Game mechanics expressed through web primitives.

This is **not CRUD with auth slapped on**.

---

## 13. Long-Term Direction (North Star)

GenPlace can evolve into:

- A cultural artifact (like r/Place snapshots).
- A platform for AI-native collaboration.
- A new genre: **“Generative Multiplayer Art”**.

Future expansions:

- Time-lapse playback.
- Region ownership.
- Themed events.
- Sponsored canvases.
- Community factions.
- Mobile-first experiences.

But **none of that matters** unless the core canvas is fun.

---

## 14. The Single Sentence Summary (For New Engineers)

> **GenPlace is a real-time, multiplayer, AI-powered canvas where prompts become territory and creativity becomes a shared game.**

=
