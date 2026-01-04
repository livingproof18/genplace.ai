# 📄 GenPlace Token System & Pricing — Plan

## 1. Purpose of the Token System

The **token system** is the economic backbone of GenPlace. It ensures:

1. **Cost control** — API calls for AI image generation are expensive. Tokens cap usage.
2. **Spam prevention** — no one can flood the system with images.
3. **Engagement mechanic** — like “energy” in a mobile game, tokens add pacing and monetization levers.

---

## 2. Token Logic (Core Rules)

### Token = Energy

- Every AI image generation **costs tokens**.
- The **cost varies by image size**:

  - 128px/256px → 1 token
  - 512px → 2 tokens
  - 768px → 3 tokens
  - 1024px → 5 tokens

### Server Validation

When a user submits a prompt:

```pseudo
if user.tokens >= size_token_cost:
    consume_tokens(user, size_token_cost)
    start_generation(prompt, size)
else:
    deny_request("Not enough tokens")
```

---

## 3. Free Users

### Allocation

- **2 lifetime demo tokens** total (not per day).
- Start state = `1/2` (psychology trick: they instantly see they’re “missing one”).
- **Refill**: 1 token after 10 minutes → but capped at 2. Once both are used, no more refill.

### Restrictions

- Can only generate **128px** images.
- After 2 gens: prompt them to upgrade or buy boosters.

### Cost Impact

- 10k DAU → 20k free generations = \$400 one-time cost.
- After that, no more free costs from those users.
  👉 Free users are purely a **conversion funnel**.

---

## 4. Premium Users

### Tiers

- **Weekly**: \$3.99
- **Monthly**: \$12.99
- Both unlock sizes 256–1024px (but 1024px gated until 10 gens completed).

### Caps (Two Layers)

1. **Daily cap** = fairness pacing.
2. **Monthly cap** = absolute ceiling (hard cost guardrail).

| Tier    | Price   | Daily Cap | Monthly Cap | Max API Cost/User |
| ------- | ------- | --------- | ----------- | ----------------- |
| Weekly  | \$3.99  | 5/day     | 20 total    | \$0.40            |
| Monthly | \$12.99 | 10/day    | 60 total    | \$1.20            |

👉 Margins: \~90%+ on both plans, even at full usage.
👉 Prevents a single “whale” user from costing more than they pay.

---

## 5. Microtransactions (One-Off Packs)

Positioned as the **gateway drug** — cheap, instant gratification.

- **Starter Pack**: \$1.99 → 10 tokens
- **Booster Pack**: \$4.99 → 30 tokens
- **Mega Pack**: \$9.99 → 80 tokens
- Limit: **3 purchases/day per user** to avoid abuse.

👉 Use these as the main upsell for free users who run out of tokens.

| Pack             | Price | Tokens                        | Notes                               |
| ---------------- | ----- | ----------------------------- | ----------------------------------- |
| **Starter Pack** | $2.99 | 10 tokens                     | Entry tier — test, retry, impulse   |
| **Booster Pack** | $4.99 | 20 tokens                     | Best value — encourage repeat buys  |
| **Mega Pack**    | $9.99 | 50 tokens                     | High-volume users, “no limits” feel |
| **Limit**        | —     | 3 purchases/day               | MVP guardrail                       |
| **Rule**         | —     | Paid tokens bypass daily caps | Cooldowns still apply               |

| Option           | Cost  | Tokens / Week          | Cost per Token |
| ---------------- | ----- | ---------------------- | -------------- |
| **Weekly Plan**  | $3.99 | 70 tokens (10/day × 7) | **$0.057**     |
| **Booster Pack** | $4.99 | 20 tokens              | **$0.25**      |
| **Mega Pack**    | $9.99 | 50 tokens              | **$0.20**      |

## 3. Recommended Balanced Ladder

Let’s use a **progressive ratio** — about **+25–30% better value per tier**.  
That’s common in game economies (Clash of Clans, Duolingo, Replit Credits).

| Pack    | Price                 | Tokens | Tokens per $ | Value Boost |
| ------- | --------------------- | ------ | ------------ | ----------- |
| Starter | **$2.99 → 10 tokens** | 3.3/ $ | baseline     |             |
| Booster | **$4.99 → 20 tokens** | 4.0/ $ | +20% better  |             |
| Mega    | **$9.99 → 50 tokens** | 5.0/ $ | +50% better  |             |

### Why this works:

- **Starter** still feels cheap (2.99 is “snack price”).
- **Booster** hits the sweet spot (most purchased).
- **Mega** doubles price but gives +150% more tokens → feels premium.

---

## 6. Gameplay Feel

- **Tokens** = creative energy.
- **Cooldown/refills** = breathing space between bursts.
- **Large sizes** feel prestigious because they cost more.
- **Free tier** is just a taste. To play meaningfully, you upgrade or buy packs.

Think: **Clash of Clans energy system, but for AI generations**.

---

## 7. Profitability & Cost Guardrails

### Example: 10k DAU

- Free (20k gens) = \$400 one-time.
- Premium (500 users) = \$4.7k revenue vs \~\$440 cost.
- Boosters (2% buyers) = \$600 revenue vs \~\$120 cost.
- **Net: +\$4,335/month**.

### Example: 100k DAU

- Free (200k gens) = \$4,000 one-time.
- Premium (5k users) = \$46.9k revenue vs \~\$4.4k cost.
- Boosters (2% buyers) = \$6k revenue vs \~\$1.2k cost.
- **Net: +\$43k/month**.

👉 Free no longer scales into runaway losses.
👉 Premium & boosters give strong, predictable margins.

---

## 8. Naming

- **MVP:** call them _Tokens_ (clear for devs and users).
- **Later:** rebrand with a thematic name (_“Gens”_, _“Sparks”_, _“Drops”_).

  - Example: _“It costs 1 Gen to create an image.”_

---

## 9. Upsell Mechanics

To drive 8–10% conversion:

- Free locked at 128px only.
- Bigger sizes = premium only.
- Glow frames, badges, or borders for premium images.
- “You’ve run out of creative energy” modals after free use.
- Starter pack (\$1.99) pushed as the easiest entry point.

---

## 10. Summary

- Free = **demo only**, capped at 2 lifetime tokens, 128px only.
- Weekly = **\$3.99, 5/day, 20/month**.
- Monthly = **\$12.99, 10/day, 60/month**.
- Microtransactions = **\$1.99–\$9.99 packs**.
- Cost per user is always capped below revenue → profitability is safe.
- UX built around **scarcity, progression, and upsells**.

---

✅ With this system, GenPlace is **bootstrapped-friendly, predictable, and profitable** at scale.

---
