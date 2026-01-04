# 🧩 GenPlace.ai — Engineering README

> **Purpose:**
> This document explains _what we are building_, _why it exists_, and _how the system is intended to work_, so any senior engineer can onboard quickly and contribute confidently.

---

## 1. Project Overview

**GenPlace.ai** is a **real-time, collaborative AI canvas** where users generate images from text prompts and place them onto a shared, zoomable map/grid.

The canvas is persistent and global — every placement is immediately visible to all users. Over time, the canvas evolves into a living artwork shaped by collaboration, competition, and overwriting.

**Core idea:**

> One prompt → one AI-generated image → one shared point on a global canvas.

This is **not** a traditional AI image generator, social network, or drawing tool.
It is closer to a **multiplayer game built on top of generative AI**.

---

## 2. Product Philosophy (Engineering Implications)

These principles guide all technical decisions.

### 2.1 The Canvas Is the Product

- The map/grid is the primary interface.
- Everything else (profiles, UI chrome, monetization) is secondary.
- All engineering work should prioritize **canvas performance, consistency, and real-time feel**.

### 2.2 Constraints Create Gameplay

Cooldowns, tokens, and overwrites are **intentional mechanics**, not limitations.

Engineering should:

- Enforce constraints server-side.
- Expose constraint state clearly to the client.
- Avoid “silent failure” UX.

### 2.3 Real-Time Is Non-Negotiable

If users do not see changes immediately:

- The experience feels fake.
- The collaborative aspect collapses.

Realtime delivery is not an optimization — it is foundational.

---

## 3. Core User Flow (Canonical)

```
User clicks point
   ↓
Prompt drawer opens
   ↓
User enters prompt + size
   ↓
Server generates AI image
   ↓
Moderation check
   ↓
User confirms placement
   ↓
Point updates for all users in real time
```

This flow should remain **fast (<30 seconds end-to-end)** and **low-friction**.

---

## 4. Mental Model of the System

### 4.1 Points, Not Images

Images are not generic media assets.

They are:

- Spatially constrained
- Grid-aligned
- Mutually exclusive per Points

### 4.2 Overwriting Is Expected

Any placement can be replaced by a newer one.

This is not abuse — it is **designed behavior**.

Engineering should assume:

- Frequent overwrites
- Concurrent placement attempts

---

## 5. Token & Cooldown System (Core Gameplay Logic)

Tokens represent **creative energy**.

### Key rules

- Generating an image is rate-limited.
- **Placing** an image consumes tokens (MVP decision).
- Tokens regenerate over time up to a cap.
- Larger images cost more tokens (future-proofed).

### Why tokens are consumed on _place_, not _generate_

- Users can explore ideas without punishment.
- UX feels fair and playful.
- Generation is still protected by server-side throttling.

This tradeoff is intentional.

---

## 6. High-Level Architecture

```
[ Client (Next.js + Map) ]
        |
        | Auth + Realtime Subscriptions
        |
[ Backend API / Edge Functions ]
        |
        | AI Generation + Moderation
        |
[ AI Provider ]
        |
        | Image Storage
        |
[ Object Storage + CDN ]
        |
        | Placement Writes
        |
[ Database + Realtime Stream ]
        |
        └──> All connected clients update canvas
```

---

## 7. Core Domains & Responsibilities

### 7.1 Client

Responsibilities:

- Rendering the canvas efficiently.
- Managing viewport-based subscriptions.
- Displaying token/cooldown state.
- Handling prompt → preview → placement UX.

Non-responsibilities:

- Cost enforcement
- Token validation
- Moderation decisions

Assume the client is **untrusted**.

---

### 7.2 Backend / API Layer

Responsibilities:

- Authentication enforcement
- Token accounting (authoritative)
- Generation rate limits
- AI provider orchestration
- Moderation gating
- Placement atomicity

This layer must be:

- Deterministic
- Idempotent where possible
- Defensive against abuse

---

### 7.3 Database

Acts as:

- Source of truth
- Event stream (via realtime)
- Concurrency gate (points/slots)

Important properties:

- Writes must be atomic per point.
- Overwrites must be ordered.
- Reads must support viewport-based queries.

---

## 8. Realtime Strategy

Realtime updates are driven by **placement events**, not polling.

Clients should:

- Subscribe only to points within or near their viewport.
- Handle late or out-of-order events gracefully.
- Re-fetch points when version/ETag changes.

Backend should:

- Emit minimal payloads.
- Prefer event-driven updates over broad invalidation.

---

## 9. Moderation Strategy (MVP)

Moderation is intentionally minimal.

### MVP approach

- Rely on AI provider safety filters.
- Reject unsafe prompts or outputs.
- Allow user reporting.
- Log everything.

### Non-goals (for MVP)

- Manual moderation queues
- Appeals workflows
- Fine-grained content taxonomy

We will evolve moderation **based on observed abuse**, not hypotheticals.

---

## 10. Performance Considerations

Key performance risks:

1. **Canvas rendering at scale**

   - Many images
   - Many zoom levels

2. **Realtime fan-out**

   - Hundreds/thousands of clients

3. **AI generation latency**

   - Must not block UI unnecessarily

4. **Image bandwidth**

   - Many small assets, high churn

Engineering strategies should prioritize:

- Viewport scoping
- CDN caching
- WebP/AVIF formats
- Versioned point URLs

---

## 11. What Engineers Should Optimize For

When making decisions, bias toward:

- **Clarity over cleverness**
- **Determinism over convenience**
- **Fairness over maximum throughput**
- **Fast feedback over feature breadth**

GenPlace succeeds if it _feels alive_, not if it has every feature.

---

## 12. Non-Goals (Important)

We are intentionally _not_ optimizing for:

- Infinite generation
- User-owned permanent territory
- Complex social graphs
- Perfect moderation on day one
- Maximum monetization at MVP

Shipping a **fun, stable, shared experience** beats everything else.

---

## 13. The One-Line Engineer Summary

> **GenPlace is a real-time, multiplayer, AI-powered canvas where spatial constraints and cooldowns turn generative art into a shared game.**

If you understand that sentence, you understand the project.

---

## 14. How to Contribute Effectively

Before building:

1. Understand the canvas mental model.
2. Identify which constraint your work affects.
3. Ask: _does this preserve the real-time illusion?_

If the answer is no — rethink.
