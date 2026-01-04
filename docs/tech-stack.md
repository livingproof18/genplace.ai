# GenPlace.ai — Updated Stack & Provider Integration Guide

**Purpose:** explain the move **back to our original stack** using **Supabase (Auth • Postgres • Realtime)**, **Cloudflare R2 + Cloudflare CDN**, **OpenAI**, and **Resend**. Includes what each provider is, why we chose it, where it’s used, how to wire it up, and cost guardrails/dev-ops checklists.

## 0) TL;DR

- **Backend:** **Supabase** (Postgres + Realtime + RPC/Edge Functions).
- **Auth:** **Supabase Auth OAuth** (Google, Discord, GitHub). No email/password at MVP.
- **Storage/CDN:** **AWS S3 + CloudFront → Cloudflare R2 + Cloudflare CDN (Pro)** (no egress fees from storage, simpler mental model for high-bandwidth tiles).
- **Email:** **Resend** used for **welcome email** (no verification emails in MVP).
- **AI:** **OpenAI** for **image generation** and **moderation** (plus optional prompt suggestions later).

Rationale: Supabase matches our long-term comfort with **SQL/RLS**, keeps costs predictable, and still gives us **Realtime** for the live canvas.

---

## 1) Providers — what, why, where

### A) Supabase (Auth • Postgres • Realtime)

- **What it is:** Fully managed **Postgres** with **Auth** (OAuth providers), **Realtime** (Postgres WAL → websockets), **Storage**, **Edge Functions**, and **Row-Level Security** (RLS).
- **Why we chose it:**

  - **SQL-first:** easy to model grid/placements, audit, and reporting.
  - **Auth built-in:** OAuth flows (Google/Discord/GitHub) without extra libs.
  - **Realtime:** DB-level change feeds → push live canvas updates.
  - **RLS:** precise server-side security without custom middle layers.

- **Where we use it:**

  - **Database:** `users`, `slots`, `placements`, `generation_requests`, `reports`.
  - **Auth:** OAuth (Google/Discord/GitHub). No passwords at MVP.
  - **Realtime:** listen to `placements` changes (viewport-scoped).
  - **Edge Functions (optional):** server-side `/generate` orchestration, rate limits, calling OpenAI, writing to R2.

### B) Cloudflare R2 + Cloudflare CDN

- **What it is:** S3-compatible object storage (**R2**) with **\$0 egress fees** from storage; fronted by **Cloudflare CDN** (self-serve plan is flat monthly; no per-GB meter on standard traffic).
- **Why we chose it:**

  - We serve **lots of small images**; egress fees dominate on traditional stacks.
  - **R2 = \$0 egress** from storage; CDN plan keeps costs legible.
  - Works great with **Workers/Cache Reserve** to keep origin reads low.

- **Where we use it:**

  - Store **generated originals** (`/raw/<requestId>.webp`) and **rendered tiles** (`/tiles/{z}/{x}/{y}.webp`).
  - CDN serves tiles to clients; strong cache headers + versioned URLs (ETag).

### C) OpenAI (image generation + moderation)

- **What it is:** APIs for **text→image** (DALL·E), **text moderation**, and **GPT** (optional prompt assistance).
- **Why we chose it:**
  - Single vendor covers both **creative** (image gen) and **safety** (moderation) paths.
  - Excellent docs + reliability for timelines.
- **Where we use it:**

  - **/generate**: call DALL·E with `{prompt, size}`; store image to R2.
  - **Moderation**: run prompt + (optionally) result through moderation before placement.
  - **(Later)** Prompt suggestions (“spice up my idea”).

### D) Resend (emails)

- **What it is:** Modern email API.
- **Why we chose it:** Simple API + great DX; free/pro tiers cover MVP nicely.
- **Where we use it:** **Welcome email** on first login (no verification flow in MVP).

---

## 2) System architecture (at a glance)

```
[ Next.js 14 (App Router) + Leaflet ]
      |         \
      |          \  (Supabase JS client: Auth + Realtime)
      v           \
[ Next API routes / Edge Functions ]  <-- Supabase Service Role (server)
   |          |          \
   |          |           \---> [OpenAI]  (Generate + Moderate)
   |          |                    |
   |          |                    v
   |          |                [Cloudflare R2]  (raw + tiles)
   |          |                    |
   |          |                    v
   |          +------ publish row in Postgres (placements)
   |                             |
   +--> clients subscribe -------[Supabase Realtime]--> live updates
                    \
                     +--> [Resend] welcome email (first login webhook)
```

**Where realtime happens:** clients subscribe to **Postgres changes** (e.g., `placements` table) via **Supabase Realtime**; we scope updates by viewport.

---

## 3) Data model (Postgres via Supabase)

> SQL tables with **RLS** enabled. Primary keys are UUIDs unless noted.

**users**

- `id UUID PK` (matches `auth.users.id`), `handle TEXT`, `oauth_provider TEXT`, `created_at TIMESTAMP`
- `tokens_available INT`, `tokens_max INT`, `token_refill_at TIMESTAMP`
- `level INT`, `strikes INT`, `banned_until TIMESTAMP`

**slots**

- `id UUID PK`
- `z INT`, `x INT`, `y INT`, `slot_idx INT` -- (grid address)
- `current_placement_id UUID NULL`
- `version INT DEFAULT 0` -- for optimistic concurrency
- Unique index on (`z`,`x`,`y`,`slot_idx`)

**generation_requests**

- `id UUID PK`
- `user_id UUID FK -> users`
- `slot_id UUID FK -> slots`
- `prompt TEXT`, `size INT`, `model TEXT`
- `status TEXT CHECK IN ('queued','generating','approved','rejected','failed')`
- `image_raw_url TEXT`, `moderation_reason TEXT`
- `created_at TIMESTAMP DEFAULT now()`, `updated_at TIMESTAMP DEFAULT now()`

**placements**

- `id UUID PK`
- `slot_id UUID FK -> slots`
- `user_id UUID FK -> users`
- `prompt TEXT`, `size INT`, `image_cdn_url TEXT`
- `created_at TIMESTAMP DEFAULT now()`

**reports**

- `id UUID PK`
- `placement_id UUID FK -> placements`
- `reporter_id UUID FK -> users`
- `reason TEXT`, `created_at TIMESTAMP DEFAULT now()`

### Suggested indexes

- `placements (slot_id, created_at DESC)`
- `generation_requests (user_id, created_at DESC)`
- `slots (z, x, y, slot_idx)`
- Partial index for fast viewport lookups, e.g. tiles in a bbox.

---

## 4) Security (RLS) & auth

**RLS ON** for all user-visible tables. Examples:

- `users`: a user can `SELECT` only their row; updates restricted to server via service role.
- `placements`: `SELECT` all (public canvas), but **INSERT** only with auth user present; optional throttles via triggers.
- `reports`: `INSERT` allowed for authenticated users; `SELECT` limited to moderators.
- `generation_requests`: `INSERT` (authenticated), `SELECT` own rows; server (service role) updates status/URLs.

**Auth (Supabase Auth):**

- Enable **Google, Discord, GitHub** in Supabase dashboard.
- **No passwords** at MVP (can add later).
- On **first login**, server creates a `users` row with defaults and sends **Resend** welcome email.

---

## 5) Core flows

### 5.1 Login (OAuth only)

1. User clicks Google/Discord/GitHub → Supabase Auth completes OAuth → returns a session/JWT to client.
2. **On first login**:

   - Server (Edge Function or Next.js route with service role) upserts a `users` row with default tokens/cooldowns.
   - Trigger **Resend** welcome email (idempotent).

### 5.2 Generate → Moderate → Place

**Client → Server**

1. `POST /api/generate` (or Supabase Edge Function) with `{prompt, size, slotId}` (auth required).

**Server steps** 2) **Token bucket** check & decrement for `user_id`. 3) Insert `generation_requests(status='queued')`. 4) Call **OpenAI** (DALL·E) → get image bytes → write to **R2** at `raw/<request_id>.webp`. 5) **Moderation** (prompt and/or output). If rejected:

- Update request to `rejected` (+ optional token refund).
- Return rejection to client.

6. On approval:

   - Compute affected **tile key** (from slot coords).
   - Composite / encode final **tile** → write to R2 `tiles/{z}/{x}/{y}.webp` (versioned).
   - Insert **placement** row with `image_cdn_url`.
   - `UPDATE slots SET current_placement_id = <placement_id>, version = version+1 WHERE id=<slot> AND version=<expected>` (optimistic concurrency).
   - Return success.

**Client realtime:** 7) Subscribed clients receive **Supabase Realtime** events for `placements` (or a denormalized `tile_updates` table if you create one). 8) Clients re-fetch changed tile URLs (ETag/version busting) or patch overlays.

---

## 6) Realtime options (Supabase)

- **Option A — Row changefeed:** subscribe to `placements` and filter on visible slots.
- **Option B — Broadcast channels:** also open a Realtime channel per “region/zoom bin” to fan-out minimal diffs (e.g., `{tile_id, etag}`). This reduces client re-compute.
- **Presence (nice-to-have):** use Realtime presence to show how many users are viewing a region.

---

## 7) API surface (Next.js routes or Edge Functions)

**Routes (illustrative):**

- `POST /api/generate` → body `{prompt, size, slotId}` → `202 {requestId}`
- `GET /api/generate/:id` → `{status, [image_raw_url], [moderation_reason]}`
- `POST /api/report` → `{placementId, reason}` → `204`

**Supabase RPC (optional):**

- `rpc.consume_token(user_id)` (atomic check+decrement).
- `rpc.place_approved(request_id)` (wraps slot update w/version check).

> You can keep all write logic in **Edge Functions** if you prefer isolating secrets (OpenAI/R2 keys) from Next.js routes.

---

## 8) Cost guardrails (MVP defaults)

- **Default image quality**: **Low (128–256px)**; gate higher sizes via level/premium.
- **Tokens/cooldown**: **1 token / 10 min**, **max 2–3 tokens**.
- **Rate limit**: per-user & per-IP in `/api/generate` (e.g., “<= 3/min”). Keep a lightweight in-DB rate log or use a simple sliding window table.
- **Tiles**: use **WebP**, long cache, versioned URLs (`?v=<etag>`).
- **Emails**: **welcome only** at MVP.

> OpenAI image gen will dwarf other costs—these guardrails keep it in check.

---

## 9) Observability & Ops

**Env vars**

- `SUPABASE_URL`, `SUPABASE_ANON_KEY` (client)
- `SUPABASE_SERVICE_ROLE_KEY` (server/Edge Functions only)
- `OPENAI_API_KEY`
- `RESEND_API_KEY`
- `CF_ACCOUNT_ID`, `CF_R2_ACCESS_KEY_ID`, `CF_R2_SECRET_ACCESS_KEY`, `CF_R2_BUCKET`
- `NEXT_PUBLIC_CDN_BASE_URL` (e.g. `https://cdn.genplace.ai`)

**Metrics to collect (first week)**

- **Gen pipeline:** success rate, moderation reject rate, avg latency.
- **OpenAI spend:** by size/quality (log a meter).
- **Realtime:** avg events/sec, client subscriptions, dropped sockets.
- **CDN:** cache hit ratio, monthly egress GB (Cloudflare dashboard).
- **DB:** slow queries (viewport queries), contention on `slots` version updates.

**Performance tips**

- Viewport queries: fetch **by tile key**, not by arbitrary bbox math per request.
- Denormalize a tiny **`tile_updates`** table `{tile_key, etag, updated_at}` to make client diffs trivial.
- Avoid chatty subscriptions: subscribe only to tiles on screen.

---

## 10) Security & abuse prevention

- **RLS** everywhere; server writes (status flips, token consume) via **service role** only.
- **Moderation:** log `moderation_reason` (enum) for analytics; build quick dashboards.
- **Overwrite fairness:** version check on `slots` prevents races; optionally require a short **slot lock** during generation to reduce collisions.
- **Audit:** keep minimal prompt hash (not full prompt) if you want privacy but still need forensics.

---

## 11) Postgres helpers (snippets)

**Token bucket (SQL-ish approach):**

```sql
-- Example: atomic consume
create or replace function consume_token(p_user uuid)
returns boolean
language plpgsql
as $$
declare v_tokens int; v_refill_at timestamptz;
begin
  select tokens_available, token_refill_at into v_tokens, v_refill_at
  from users where id = p_user for update;

  -- refill on read
  if now() >= v_refill_at then
    v_tokens := least(v_tokens + floor(extract(epoch from (now() - v_refill_at)) / (10*60))::int + 1, tokens_max);
    update users
      set tokens_available = v_tokens,
          token_refill_at = now() + interval '10 minutes'
      where id = p_user;
  end if;

  if v_tokens <= 0 then
    return false;
  end if;

  update users
    set tokens_available = tokens_available - 1
    where id = p_user;
  return true;
end $$;
```

**Optimistic slot update (versioned):**

```sql
update slots
set current_placement_id = :placement_id,
    version = version + 1
where id = :slot_id and version = :expected_version;
-- check rowCount == 1 on server; else retry or refund token
```

---

## 12) Migration/rollback comfort

- We’re **already on Supabase** — no changes needed later to “un-hackathon” our stack.
- If we ever need a different DB, keep a thin **data-access layer** in the app (e.g., `/lib/db/*`) so the UI doesn’t depend on direct client queries.

---

## 13) Open questions / next steps

- Add **verification emails** later? (Resend + Supabase Auth settings).
- Add **presence** counters (Realtime).
- Add **time-lapse** (keep placement history snapshots or diffs).
- Introduce **paid tier** (Stripe/Autumn) once usage patterns stabilize.

---

If you want, I can convert this into a **repo-ready `/docs/stack-choice.md`**, plus a **`.env.example`** and a small **SQL migration** file (tables + indexes + baseline RLS policies) so your team can plug and play.
