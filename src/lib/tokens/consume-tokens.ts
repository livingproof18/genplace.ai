import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { MODEL_TOKEN_COST, type TokenModelId } from "./model-cost";

export const COOLDOWN_MS = 15_000;

export type TokenState = {
  tokens_current: number;
  tokens_max: number;
  cooldown_until: string | null;
  total_generations: number;
};

export type TokenConsumeErrorCode = "COOLDOWN_ACTIVE" | "INSUFFICIENT_TOKENS";

export class TokenConsumeError extends Error {
  code: TokenConsumeErrorCode;

  constructor(code: TokenConsumeErrorCode, message: string) {
    super(message);
    this.name = "TokenConsumeError";
    this.code = code;
  }
}

type UserTokenRow = {
  tokens_current: number;
  tokens_max: number;
  cooldown_until: string | null;
  total_generations: number | null;
};

function isCooldownActive(cooldownUntil: string | null, nowMs: number) {
  if (!cooldownUntil) return false;
  const cooldownMs = Date.parse(cooldownUntil);
  return Number.isFinite(cooldownMs) && cooldownMs > nowMs;
}

export async function consumeTokens(userId: string, model: TokenModelId) {
  const cost = MODEL_TOKEN_COST[model];
  const supabase = createAdminClient();

  // MVP assumption: tokens are deducted up-front and cooldown is applied per generation request.
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const { data: user, error } = await supabase
      .from("users")
      .select("tokens_current,tokens_max,cooldown_until,total_generations")
      .eq("id", userId)
      .single<UserTokenRow>();

    if (error) {
      throw error;
    }

    const nowMs = Date.now();
    if (isCooldownActive(user.cooldown_until, nowMs)) {
      throw new TokenConsumeError(
        "COOLDOWN_ACTIVE",
        "Cooldown active. Please wait before generating again."
      );
    }

    if (user.tokens_current < cost) {
      throw new TokenConsumeError(
        "INSUFFICIENT_TOKENS",
        "Not enough tokens to generate with this model."
      );
    }

    const nextCooldown = new Date(nowMs + COOLDOWN_MS).toISOString();
    const nextTotal = (user.total_generations ?? 0) + 1;

    // Compare-and-swap update to keep token consumption atomic under concurrency.
    let updateQuery = supabase
      .from("users")
      .update({
        tokens_current: user.tokens_current - cost,
        cooldown_until: nextCooldown,
        total_generations: nextTotal,
      })
      .eq("id", userId)
      .eq("tokens_current", user.tokens_current);

    updateQuery =
      user.cooldown_until === null
        ? updateQuery.is("cooldown_until", null)
        : updateQuery.eq("cooldown_until", user.cooldown_until);

    const { data: updated, error: updateError } = await updateQuery
      .select("tokens_current,tokens_max,cooldown_until,total_generations")
      .maybeSingle<TokenState>();

    if (updateError) {
      throw updateError;
    }

    if (updated) {
      return updated;
    }
  }

  throw new Error("Token update conflicted. Please retry.");
}
