import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { MODEL_TOKEN_COST, type TokenModelId } from "@/lib/tokens/model-cost";

type GenerationRequestRow = {
  id: string;
  user_id: string;
  prompt: string;
  model: string;
  size: number;
  status: "queued" | "generating" | "approved" | "rejected" | "failed";
  token_cost: number;
  image_url: string | null;
  moderation_reason: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
};

type CreateGenerationParams = {
  userId: string;
  prompt: string;
  model: TokenModelId;
  size: number;
};

export async function createGenerationRequest({
  userId,
  prompt,
  model,
  size,
}: CreateGenerationParams) {
  if (!(model in MODEL_TOKEN_COST)) {
    throw new Error("Unsupported token model.");
  }

  const tokenCost = MODEL_TOKEN_COST[model];
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("generation_requests")
    .insert({
      user_id: userId,
      prompt,
      model,
      size,
      status: "queued",
      token_cost: tokenCost,
    })
    .select("*")
    .single<GenerationRequestRow>();

  if (error) {
    throw error;
  }

  return data;
}
