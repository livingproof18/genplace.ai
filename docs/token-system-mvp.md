# GenPlace.ai — MVP Token System (README)

## Overview

This document defines the **current MVP token, pricing, and cost-control system** for GenPlace.ai.

During implementation, we validated real-world constraints from image generation providers. Based on those findings, we intentionally **simplified and reshaped the original plan** to enable:

- Faster shipping
- Lower implementation complexity
- Strong profitability guardrails
- Flexibility to evolve post‑MVP

This README reflects the **authoritative MVP logic**. Anything not described here is intentionally deferred.

---

## Key MVP Decisions (Summary)

For the current fast MVP stage:

- ❌ No Premium / Subscription tiers (yet)
- ❌ No Free tier (yet)
- ✅ **Microtransactions (one‑off token packs) only**
- ✅ **Model‑based token costs (not image size)**
- ✅ **Cooldown as the only throttle**
- ✅ Simple, predictable economics

Subscriptions, free tiers, daily/monthly caps, and regeneration mechanics will be added **after validation**.

---

## Core Concept

### Tokens = Creative Energy

- Every AI image generation consumes **tokens**
- Token cost depends on **model selection**
- Image size does **not** affect token cost
- Tokens are purchased via **one‑off packs**

This design mirrors real provider pricing and keeps the mental model clear:

> Premium models cost more energy.

---

## Monetization Model (MVP)

### Microtransactions Only

Token packs are the **only payment method** in the MVP.

This avoids:

- Subscription churn logic
- Free‑tier abuse
- Complex caps or resets
- Over‑engineering before product validation

---

## Token Packs

| Pack        | Price | Tokens | Revenue / Token |
| ----------- | ----- | ------ | --------------- |
| **Starter** | $2.99 | 10     | **$0.299**      |
| **Booster** | $4.99 | 20     | **$0.249**      |
| **Mega**    | $9.99 | 40     | **$0.249**      |

### Notes

- Starter is an impulse / entry pack
- Booster is the primary repeat‑purchase pack
- Mega is for power users without enabling runaway usage
- Packs are **additive** (tokens accumulate)

---

## Model‑Based Token Costs (Critical Change)

Token costs are no longer tied to image size.

Instead, **each generation model has a fixed token cost** based on real infrastructure pricing.

### Token Cost by Model

| Model                      | Token Cost   | Rationale                                          |
| -------------------------- | ------------ | -------------------------------------------------- |
| **Google Nano Banana**     | **1 token**  | Cheapest, fastest, ideal for testing & viral usage |
| **Stability Image Core**   | **1 token**  | Low cost, good baseline quality                    |
| **OpenAI gpt‑image‑1**     | **2 tokens** | Premium quality, higher infra cost                 |
| **OpenAI gpt‑image‑1.5**   | **3 tokens** | High quality, expensive                            |
| **Google Nano Banana Pro** | **3 tokens** | Higher infra cost                                  |

Internally, models can be grouped as:

- **Fast** → 1 token
- **Standard** → 2 tokens
- **Premium** → 3 tokens

---

## Token Spend Semantics

This section defines **when and how tokens are deducted** during image generation. It is critical for user trust, cost safety, and correct backend behavior.

### Guiding Principle

> **Tokens pay for the act of generation, not for the outcome.**

Once a generation request starts, infrastructure costs are incurred. Token deduction timing reflects this reality.

---

### When Tokens Are Deducted

**Tokens are deducted immediately when the user submits a generation request (prompt submit).**

Flow:

1. User selects a model (UI clearly shows token cost)
2. User clicks **Generate**
3. Backend validates sufficient token balance
4. **Full token cost is deducted immediately**
5. Image generation request starts

This applies equally to 1‑token, 2‑token, and 3‑token models.

---

### Refund Policy (System Failures Only)

Tokens are **automatically refunded** if and only if the generation fails due to a system issue.

Refund conditions include:

- Provider API error
- Request timeout
- Backend crash before image is returned
- Any non-user-caused failure

Refund conditions do **not** include:

- User dissatisfaction with result
- Prompt quality issues
- User cancellation mid-generation
- Successful generation (even if image is not placed)

This ensures fairness without opening abuse vectors.

---

### UX Requirements

To maintain trust and clarity, the UI must:

- Always display **token cost before generation** (e.g. “Costs 2 tokens”)
- Change button state during generation (e.g. “Generating…”)
- Show clear feedback on failure:

  - Example: “Generation failed — your tokens were refunded.”

Tokens should never be deducted silently.

---

### Backend Implementation Pattern

Recommended server-side flow:

```ts
// Validate balance
if (user.tokens < tokenCost) {
  throw new Error("Not enough tokens")
}

// Deduct immediately
markTokenTransaction(userId, tokenCost, "pending")

try {
  const image = await generateImage(...)
  commitTokenTransaction(userId, tokenCost)
  return image
} catch (err) {
  refundTokenTransaction(userId, tokenCost)
  throw err
}
```

Token transactions should be auditable with clear states:

- `pending`
- `committed`
- `refunded`

---

### Explicitly Avoided Patterns

The following approaches are intentionally not used:

- Partial token deduction (e.g. 1 token upfront, rest later)
- Deducting tokens after generation completes
- Deducting tokens on placement
- Free retries or free regenerations

These patterns increase complexity, reduce cost safety, or create user confusion.

---

### Summary

- Tokens are deducted **at generation start**
- Refunds occur **only on system failure**
- Cost is always visible before action
- This model balances user trust with infrastructure safety

---

## Token Consumption Flow

### Server‑Side Logic

1. User submits:

   - Prompt
   - Selected model

2. Backend resolves token cost:

```ts
const tokenCost = MODEL_COST[model];
```

3. Validation:

```ts
if (user.tokens < tokenCost) {
  throw new Error("Not enough tokens");
}
```

4. Tokens are deducted **before** generation starts
5. Image generation is executed
6. Cooldown timer begins

---

## Cooldowns (Only Throttle in MVP)

- Cooldowns prevent spam and burst abuse
- Applied per generation request
- Example: 10–15 seconds between generations
- No daily or monthly token caps in MVP

Cooldowns are the **only pacing mechanism** at this stage.

---

## What Is Intentionally NOT Included

To keep the MVP focused and fast, the following are **explicitly deferred**:

- Free tier users
- Subscription plans
- Daily / monthly token caps
- Token regeneration mechanics
- Image‑size‑based pricing
- Login streaks or rewards
- Tiered cooldown speeds

These will be revisited once usage patterns are validated.

---

## Profitability & Cost Guardrails

- Average revenue per token: **~$0.25**
- Worst‑case infra cost per token: **~$0.05–0.06**
- Gross margin per token: **~75–80%**

Additional safety factors:

- Cheaper (1‑token) models dominate early usage
- Cooldowns slow burn rate
- No free tier eliminates unbounded cost

This system remains profitable even under pessimistic assumptions.

---

## Strategic Intent

The MVP answers one core question:

> **Will users pay to generate and place AI images on a shared canvas?**

Everything else (subscriptions, free demos, rewards, advanced pricing) comes **after** we have real data.

This design optimizes for:

- Speed of shipping
- Clear analytics
- Cost safety
- Flexibility to evolve

---

## MVP System Snapshot

- Tokens only (no subs, no free tier)
- Packs: **10 / 20 / 40 tokens**
- Prices: **$2.99 / $4.99 / $9.99**
- Model‑based costs: **1 / 2 / 3 tokens**
- Cooldown‑only throttling
- Image size not priced
- Simple backend logic
- Strong margins

---

**This README represents the current source of truth for the GenPlace.ai MVP token system.**
